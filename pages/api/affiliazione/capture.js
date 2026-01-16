import paypal from '@paypal/checkout-server-sdk'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'
import { Resend } from 'resend'
import { generateMembershipCardPdf } from '../../../lib/membershipCardPdf'
import crypto from 'crypto'

// Inizializza PayPal client opzionalmente (non blocca startup se manca)
let client = null
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  const environment = process.env.NODE_ENV === 'production'
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
  client = new paypal.core.PayPalHttpClient(environment)
}

// Inizializza Resend (opzionale, non blocca se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

// Schema di validazione Zod
const captureSchema = z.object({
  orderID: z
    .string()
    .min(1, 'OrderID obbligatorio')
    .transform((val) => val.trim()),
})

/**
 * Genera un numero tessera univoco nel formato FENAM-YYYY-XXXXXX
 * @returns {string} Formato: FENAM-2026-ABC123
 */
function generateMemberNumber() {
  const year = new Date().getFullYear()
  // Genera 6 caratteri alfanumerici uppercase
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `FENAM-${year}-${randomPart}`
}

/**
 * Genera un memberNumber univoco con retry in caso di collisione
 * @param {number} maxRetries - Numero massimo di tentativi (default: 5)
 * @returns {Promise<string>} MemberNumber univoco
 */
async function generateUniqueMemberNumber(maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const memberNumber = generateMemberNumber()
    try {
      // Verifica se esiste già
      const existing = await prisma.affiliation.findUnique({
        where: { memberNumber },
      })
      if (!existing) {
        return memberNumber
      }
      // Se esiste, rigenera
      console.warn(
        `⚠️ [MemberNumber] Collisione rilevata per ${memberNumber}, tentativo ${attempt + 1}/${maxRetries}`
      )
    } catch (error) {
      // Se errore diverso da "not found", rilancia
      if (error.code !== 'P2025') {
        throw error
      }
      return memberNumber
    }
  }
  throw new Error(
    `Impossibile generare memberNumber univoco dopo ${maxRetries} tentativi`
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting: 10 richieste/minuto per IP
  const allowed = await rateLimit(req, res)
  if (!allowed) {
    return // rateLimit ha già inviato la risposta 429
  }

  // Verifica PayPal configurato
  if (!client) {
    console.error('❌ [PayPal Capture] PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET non configurati')
    return res.status(503).json({
      error: 'Servizio pagamenti non disponibile',
      message: 'PayPal non configurato. Contatta il supporto.',
    })
  }

  // 1) Validazione input con Zod
  const parseResult = captureSchema.safeParse(req.body)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return res.status(400).json({
      error: firstError.message || 'Validazione fallita',
      details: parseResult.error.errors,
    })
  }

  const { orderID } = parseResult.data

  try {
    // 2) Esegui PayPal capture
    const request = new paypal.orders.OrdersCaptureRequest(orderID)
    // Nota: per capture, il body è opzionale (vuoto)

    const captureResponse = await client.execute(request)
    const order = captureResponse.result

    // 3) Estrai dati dalla risposta PayPal
    const status = order.status || 'UNKNOWN'
    const payerEmail =
      order.payer?.email_address || order.payer?.email || null

    // Estrai captureId e amount dalla prima purchase_unit
    let captureId = null
    let amount = null
    let currency = null

    if (order.purchase_units && order.purchase_units.length > 0) {
      const purchaseUnit = order.purchase_units[0]
      if (purchaseUnit.payments?.captures && purchaseUnit.payments.captures.length > 0) {
        const capture = purchaseUnit.payments.captures[0]
        captureId = capture.id || null
        if (capture.amount) {
          amount = capture.amount.value || null
          currency = capture.amount.currency_code || null
        }
      }
    }

    // 4) Aggiorna DB (Prisma)
    const existingAffiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
    })

    if (!existingAffiliation) {
      // OrderId non trovato: ritorna 404 (non creiamo record senza dati utente)
      console.error(`❌ [PayPal Capture] OrderId ${orderID} non trovato nel DB`)
      return res.status(404).json({
        error: 'Affiliazione non trovata',
        details: 'OrderID non presente nel database. Contatta il supporto.',
      })
    }

    // Se già completed, ritorna successo (idempotente)
    // Nota: non reinviamo email se già inviata (confirmationEmailSentAt presente)
    if (existingAffiliation.status === 'completed') {
      return res.status(200).json({
        ok: true,
        status: 'completed',
        orderID,
        message: 'Affiliazione già completata',
      })
    }

    // LOGICA RINNOVO: Cerca socio esistente con stessa email o payerEmail
    // Strategia: Se esiste un socio attivo, estendi memberUntil; altrimenti crea nuovo periodo
    let existingMember = null
    const searchEmail = payerEmail || existingAffiliation.email
    if (searchEmail) {
      // Cerca per email o payerEmail (escludendo il record corrente)
      existingMember = await prisma.affiliation.findFirst({
        where: {
          AND: [
            { id: { not: existingAffiliation.id } },
            {
              OR: [
                { email: searchEmail.toLowerCase() },
                { payerEmail: searchEmail.toLowerCase() },
              ],
            },
            { status: 'completed' },
          ],
        },
        orderBy: { memberUntil: 'desc' }, // Prendi quello con scadenza più recente
      })
    }

    // Aggiorna status, payerEmail e membership dates
    const updateData = {
      status: 'completed',
    }

    // Salva payerEmail solo se diversa da quella del form e se disponibile
    if (payerEmail && payerEmail !== existingAffiliation.email) {
      updateData.payerEmail = payerEmail
    }

    // Imposta membership dates (logica rinnovo)
    const now = new Date()
    let isRenewal = false

    if (existingMember && existingMember.memberUntil) {
      // RINNOVO: Estendi da scadenza attuale se ancora attiva, altrimenti da oggi
      const existingUntil = new Date(existingMember.memberUntil)
      if (existingUntil > now) {
        // Membership ancora attiva: estendi da scadenza attuale
        const oneYearLater = new Date(existingUntil)
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
        updateData.memberUntil = oneYearLater
        updateData.memberSince = existingMember.memberSince || now
        isRenewal = true
        console.log(
          `🔄 [PayPal Capture] Rinnovo membership per ${searchEmail}: estesa da ${existingUntil.toISOString()} a ${oneYearLater.toISOString()}`
        )
      } else {
        // Membership scaduta: inizia da oggi
        const oneYearLater = new Date(now)
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
        updateData.memberUntil = oneYearLater
        updateData.memberSince = now
        isRenewal = true
        console.log(
          `🔄 [PayPal Capture] Rinnovo membership scaduta per ${searchEmail}: nuovo periodo da oggi`
        )
      }
    } else {
      // NUOVA MEMBERSHIP: Imposta dates se non già presenti (idempotenza)
      if (!existingAffiliation.memberSince) {
        updateData.memberSince = now
      }
      if (!existingAffiliation.memberUntil) {
        // Membership valida per 1 anno (365 giorni)
        const oneYearLater = new Date(now)
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
        updateData.memberUntil = oneYearLater
      }
    }

    // Genera memberNumber se non presente (idempotenza)
    if (!existingAffiliation.memberNumber) {
      try {
        updateData.memberNumber = await generateUniqueMemberNumber()
        console.log(
          `✅ [PayPal Capture] Generato memberNumber ${updateData.memberNumber} per order ${orderID}`
        )
      } catch (memberNumberError) {
        console.error(
          `❌ [PayPal Capture] Errore generazione memberNumber per order ${orderID}:`,
          memberNumberError
        )
        // Non blocchiamo il capture, ma loggiamo l'errore
      }
    }

    // Aggiorna DB con tutti i dati
    const updatedAffiliation = await prisma.affiliation.update({
      where: { orderId: orderID },
      data: updateData,
    })

    // 5) Invio email di conferma (idempotente: solo se non già inviata)
    let emailSent = false
    if (resend && !updatedAffiliation.confirmationEmailSentAt) {
      try {
        const emailSubject =
          process.env.AFFILIAZIONE_EMAIL_SUBJECT ||
          'Conferma affiliazione FENAM'

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.it'
        const totalAmount = amount
          ? `${amount} ${currency || 'EUR'}`
          : '€85,00 (quota base)'

        // Template email HTML
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #8fd1d2; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #fff; padding: 15px; border-left: 4px solid #8fd1d2; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #8fd1d2; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #fff; margin: 0;">FENAM</h1>
      <p style="color: #fff; margin: 5px 0 0 0;">Federazione Nazionale Associazioni Multiculturali</p>
    </div>
    <div class="content">
      <h2>Grazie per la tua affiliazione!</h2>
      <p>Caro/a <strong>${existingAffiliation.nome} ${existingAffiliation.cognome}</strong>,</p>
      <p>La tua richiesta di affiliazione a FENAM è stata completata con successo.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Riepilogo affiliazione</h3>
        <p><strong>Nome:</strong> ${existingAffiliation.nome} ${existingAffiliation.cognome}</p>
        <p><strong>Email:</strong> ${existingAffiliation.email}</p>
        <p><strong>Importo totale:</strong> ${totalAmount}</p>
        <p><strong>ID Ordine:</strong> ${orderID}</p>
      </div>

      <p>La tua tessera di affiliazione ti darà accesso a tutti i vantaggi esclusivi riservati ai soci FENAM.</p>
      
      <p>Per qualsiasi domanda o informazione, non esitare a contattarci:</p>
      <ul>
        <li>Email: <a href="mailto:info@fenam.it">info@fenam.it</a></li>
        <li>Visita il nostro sito: <a href="${baseUrl}">${baseUrl}</a></li>
      </ul>

      <div style="text-align: center;">
        <a href="${baseUrl}" class="button">Visita il sito FENAM</a>
      </div>

      <p>Grazie ancora per aver scelto di far parte della nostra comunità!</p>
      <p>Cordiali saluti,<br><strong>Il team FENAM</strong></p>
    </div>
    <div class="footer">
      <p>FENAM - Federazione Nazionale Associazioni Multiculturali</p>
      <p>Questa email è stata inviata automaticamente. Si prega di non rispondere.</p>
    </div>
  </div>
</body>
</html>
        `

        // Versione testo semplice (fallback)
        const textContent = `
FENAM - Federazione Nazionale Associazioni Multiculturali

Grazie per la tua affiliazione!

Caro/a ${existingAffiliation.nome} ${existingAffiliation.cognome},

La tua richiesta di affiliazione a FENAM è stata completata con successo.

RIEPILOGO AFFILIAZIONE:
- Nome: ${existingAffiliation.nome} ${existingAffiliation.cognome}
- Email: ${existingAffiliation.email}
- Importo totale: ${totalAmount}
- ID Ordine: ${orderID}

La tua tessera di affiliazione ti darà accesso a tutti i vantaggi esclusivi riservati ai soci FENAM.

Per qualsiasi domanda o informazione:
- Email: info@fenam.it
- Sito web: ${baseUrl}

Grazie ancora per aver scelto di far parte della nostra comunità!

Cordiali saluti,
Il team FENAM

---
FENAM - Federazione Nazionale Associazioni Multiculturali
Questa email è stata inviata automaticamente. Si prega di non rispondere.
        `.trim()

        await resend.emails.send({
          from: process.env.SENDER_EMAIL,
          to: updatedAffiliation.email,
          subject: emailSubject,
          html: htmlContent,
          text: textContent,
        })

        // Aggiorna confirmationEmailSentAt dopo invio riuscito
        await prisma.affiliation.update({
          where: { orderId: orderID },
          data: { confirmationEmailSentAt: new Date() },
        })

        emailSent = true
        console.log(
          `✅ [PayPal Capture] Email di conferma inviata a ${updatedAffiliation.email} per order ${orderID}`
        )
      } catch (emailError) {
        // Errore invio email: loggiamo ma non blocchiamo il capture
        console.error('❌ [PayPal Capture] Errore invio email di conferma:', {
          orderID,
          email: updatedAffiliation.email,
          error: emailError.message,
          // Non loggiamo dettagli sensibili
        })
        // confirmationEmailSentAt rimane null, potremo riprovare in futuro
      }
    } else if (!resend) {
      console.warn(
        `⚠️ [PayPal Capture] Resend non configurato, email di conferma non inviata per order ${orderID}`
      )
    } else if (updatedAffiliation.confirmationEmailSentAt) {
      console.log(
        `ℹ️ [PayPal Capture] Email già inviata precedentemente per order ${orderID}`
      )
    }

    // 6) Invio tessera PDF (idempotente: solo se non già inviata)
    let cardSent = false
    if (
      resend &&
      updatedAffiliation.status === 'completed' &&
      updatedAffiliation.memberNumber &&
      !updatedAffiliation.membershipCardSentAt
    ) {
      try {
        // Genera PDF tessera (passa ID univoco = affiliation.id)
        const pdfBuffer = await generateMembershipCardPdf({
          nome: updatedAffiliation.nome,
          cognome: updatedAffiliation.cognome,
          memberNumber: updatedAffiliation.memberNumber,
          memberSince: updatedAffiliation.memberSince,
          memberUntil: updatedAffiliation.memberUntil,
          id: updatedAffiliation.id, // ID univoco interno
        })

        // Converti buffer a base64 per Resend
        const pdfBase64 = pdfBuffer.toString('base64')

        // Invia email con PDF allegato
        await resend.emails.send({
          from: process.env.SENDER_EMAIL,
          to: updatedAffiliation.email,
          subject: 'La tua tessera socio FENAM',
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #8fd1d2; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #fff; padding: 15px; border-left: 4px solid #8fd1d2; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #fff; margin: 0;">FENAM</h1>
      <p style="color: #fff; margin: 5px 0 0 0;">Federazione Nazionale Associazioni Multiculturali</p>
    </div>
    <div class="content">
      <h2>La tua tessera socio è pronta!</h2>
      <p>Caro/a <strong>${updatedAffiliation.nome} ${updatedAffiliation.cognome}</strong>,</p>
      <p>In allegato troverai la tua tessera socio FENAM in formato PDF.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Dettagli tessera</h3>
        <p><strong>Numero tessera:</strong> ${updatedAffiliation.memberNumber}</p>
        ${updatedAffiliation.memberSince ? `<p><strong>Valida dal:</strong> ${new Date(updatedAffiliation.memberSince).toLocaleDateString('it-IT')}</p>` : ''}
        ${updatedAffiliation.memberUntil ? `<p><strong>Valida fino al:</strong> ${new Date(updatedAffiliation.memberUntil).toLocaleDateString('it-IT')}</p>` : ''}
      </div>

      <p>Puoi stampare la tessera o conservarla sul tuo dispositivo. La tessera include un QR code per la verifica online.</p>
      
      <p>Per qualsiasi domanda o informazione:</p>
      <ul>
        <li>Email: <a href="mailto:info@fenam.it">info@fenam.it</a></li>
        <li>Visita il nostro sito: <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.it'}">${process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.it'}</a></li>
      </ul>

      <p>Grazie per essere parte della nostra comunità!</p>
      <p>Cordiali saluti,<br><strong>Il team FENAM</strong></p>
    </div>
    <div class="footer">
      <p>FENAM - Federazione Nazionale Associazioni Multiculturali</p>
      <p>Questa email è stata inviata automaticamente. Si prega di non rispondere.</p>
    </div>
  </div>
</body>
</html>
          `,
          text: `
FENAM - Federazione Nazionale Associazioni Multiculturali

La tua tessera socio è pronta!

Caro/a ${updatedAffiliation.nome} ${updatedAffiliation.cognome},

In allegato troverai la tua tessera socio FENAM in formato PDF.

DETTAGLI TESSERA:
- Numero tessera: ${updatedAffiliation.memberNumber}
${updatedAffiliation.memberSince ? `- Valida dal: ${new Date(updatedAffiliation.memberSince).toLocaleDateString('it-IT')}` : ''}
${updatedAffiliation.memberUntil ? `- Valida fino al: ${new Date(updatedAffiliation.memberUntil).toLocaleDateString('it-IT')}` : ''}

Puoi stampare la tessera o conservarla sul tuo dispositivo. La tessera include un QR code per la verifica online.

Per qualsiasi domanda o informazione:
- Email: info@fenam.it
- Sito web: ${process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.it'}

Grazie per essere parte della nostra comunità!

Cordiali saluti,
Il team FENAM

---
FENAM - Federazione Nazionale Associazioni Multiculturali
Questa email è stata inviata automaticamente. Si prega di non rispondere.
          `.trim(),
          attachments: [
            {
              filename: `Tessera_FENAM_${updatedAffiliation.memberNumber}.pdf`,
              content: pdfBase64,
              contentType: 'application/pdf',
            },
          ],
        })

        // Aggiorna membershipCardSentAt dopo invio riuscito
        await prisma.affiliation.update({
          where: { orderId: orderID },
          data: { membershipCardSentAt: new Date() },
        })

        cardSent = true
        console.log(
          `✅ [PayPal Capture] Tessera PDF inviata a ${updatedAffiliation.email} per order ${orderID} (memberNumber: ${updatedAffiliation.memberNumber})`
        )
      } catch (cardError) {
        // Errore invio tessera: loggiamo ma non blocchiamo il capture
        console.error('❌ [PayPal Capture] Errore invio tessera PDF:', {
          orderID,
          memberNumber: updatedAffiliation.memberNumber,
          email: updatedAffiliation.email,
          error: cardError.message,
          // Non loggiamo dettagli sensibili
        })
        // membershipCardSentAt rimane null, potremo riprovare in futuro
      }
    } else if (!resend) {
      console.warn(
        `⚠️ [PayPal Capture] Resend non configurato, tessera PDF non inviata per order ${orderID}`
      )
    } else if (updatedAffiliation.membershipCardSentAt) {
      console.log(
        `ℹ️ [PayPal Capture] Tessera già inviata precedentemente per order ${orderID}`
      )
    } else if (!updatedAffiliation.memberNumber) {
      console.warn(
        `⚠️ [PayPal Capture] memberNumber non disponibile, tessera PDF non inviata per order ${orderID}`
      )
    }

    // Log informazioni capture (senza dati sensibili)
    console.log(`✅ [PayPal Capture] Order ${orderID} completato`, {
      status,
      captureId,
      amount,
      currency,
      payerEmail: payerEmail ? 'presente' : 'non disponibile',
      memberNumber: updatedAffiliation.memberNumber || 'non generato',
      emailSent,
      cardSent,
    })

    return res.status(200).json({
      ok: true,
      status,
      orderID,
      captureId,
      amount,
      currency,
      memberNumber: updatedAffiliation.memberNumber,
      emailSent,
      cardSent,
    })
  } catch (paypalError) {
    // Errore PayPal: log dettagliato (senza esporre secret)
    console.error('❌ [PayPal Capture] PayPal error:', {
      message: paypalError.message,
      statusCode: paypalError.statusCode,
      orderID,
      // Non loggiamo il body completo per sicurezza
    })

    // Se l'errore è specifico (es. order già catturato), possiamo gestirlo meglio
    if (paypalError.statusCode === 422) {
      // 422 = Unprocessable Entity (es. order già catturato o non valido)
      return res.status(502).json({
        error: 'PayPal error',
        details: 'Ordine non valido o già processato',
      })
    }

    return res.status(502).json({ error: 'PayPal error' })
  }
}
