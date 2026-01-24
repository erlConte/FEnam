// pages/api/dev/test-capture.js
// Endpoint di test per simulare il capture PayPal completo (solo in development)
// Questo bypassa PayPal e testa direttamente la logica di generazione tessera e invio email

import { prisma } from '../../../lib/prisma'
import { Resend } from 'resend'
import { generateMembershipCardPdf } from '../../../lib/membershipCardPdf'
import crypto from 'crypto'

// Inizializza Resend (opzionale, non blocca se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

/**
 * Genera un numero tessera univoco nel formato FENAM-YYYY-XXXXXX
 */
function generateMemberNumber() {
  const year = new Date().getFullYear()
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `FENAM-${year}-${randomPart}`
}

/**
 * Genera un memberNumber univoco con retry in caso di collisione
 */
async function generateUniqueMemberNumber(maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const memberNumber = generateMemberNumber()
    try {
      const existing = await prisma.affiliation.findUnique({
        where: { memberNumber },
      })
      if (!existing) {
        return memberNumber
      }
      console.warn(
        `⚠️ [Test Capture] Collisione rilevata per ${memberNumber}, tentativo ${attempt + 1}/${maxRetries}`
      )
    } catch (error) {
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
  // Solo in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' })
  }

  // Protezione aggiuntiva: richiedi header segreto se configurato
  const devKey = process.env.DEV_ONLY_KEY
  if (devKey) {
    const providedKey = req.headers['x-dev-key']
    if (!providedKey || providedKey !== devKey) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { orderID, email } = req.body

  if (!orderID) {
    return res.status(400).json({ error: 'orderID è obbligatorio' })
  }

  try {
    // 1) Trova l'affiliazione nel DB
    const existingAffiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
    })

    if (!existingAffiliation) {
      return res.status(404).json({
        error: 'Affiliazione non trovata',
        details: `OrderID ${orderID} non presente nel database. Crea prima un ordine tramite /api/affiliazione/paypal`,
      })
    }

    // Se già completed, ritorna successo (idempotente)
    if (existingAffiliation.status === 'completed') {
      return res.status(200).json({
        ok: true,
        status: 'completed',
        orderID,
        message: 'Affiliazione già completata',
        memberNumber: existingAffiliation.memberNumber,
      })
    }

    // 2) LOGICA RINNOVO: Cerca socio esistente con stessa email
    let existingMember = null
    const searchEmail = email || existingAffiliation.email
    if (searchEmail) {
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
        orderBy: { memberUntil: 'desc' },
      })
    }

    // 3) Aggiorna status e membership dates
    const now = new Date()
    const updateData = {
      status: 'completed',
      payerEmail: email || existingAffiliation.email,
    }

    // Imposta membership dates (logica rinnovo)
    if (existingMember && existingMember.memberUntil) {
      const existingUntil = new Date(existingMember.memberUntil)
      if (existingUntil > now) {
        // Membership ancora attiva: estendi da scadenza attuale
        const oneYearLater = new Date(existingUntil)
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
        updateData.memberUntil = oneYearLater
        updateData.memberSince = existingMember.memberSince || now
        console.log(
          `🔄 [Test Capture] Rinnovo membership per ${searchEmail}: estesa da ${existingUntil.toISOString()} a ${oneYearLater.toISOString()}`
        )
      } else {
        // Membership scaduta: inizia da oggi
        const oneYearLater = new Date(now)
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
        updateData.memberUntil = oneYearLater
        updateData.memberSince = now
        console.log(
          `🔄 [Test Capture] Rinnovo membership scaduta per ${searchEmail}: nuovo periodo da oggi`
        )
      }
    } else {
      // NUOVA MEMBERSHIP
      updateData.memberSince = now
      const oneYearLater = new Date(now)
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
      updateData.memberUntil = oneYearLater
    }

    // Genera memberNumber se non presente
    if (!existingAffiliation.memberNumber) {
      try {
        updateData.memberNumber = await generateUniqueMemberNumber()
        console.log(
          `✅ [Test Capture] Generato memberNumber ${updateData.memberNumber} per order ${orderID}`
        )
      } catch (memberNumberError) {
        console.error(
          `❌ [Test Capture] Errore generazione memberNumber:`,
          memberNumberError
        )
      }
    }

    // Aggiorna DB
    const updatedAffiliation = await prisma.affiliation.update({
      where: { orderId: orderID },
      data: updateData,
    })

    // 4) Invio email di conferma (idempotente)
    let emailSent = false
    if (resend && !updatedAffiliation.confirmationEmailSentAt) {
      try {
        const emailSubject =
          process.env.AFFILIAZIONE_EMAIL_SUBJECT ||
          'Conferma affiliazione FENAM (TEST)'

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

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
    .test-badge { background-color: #ff9800; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #fff; margin: 0;">FENAM</h1>
      <p style="color: #fff; margin: 5px 0 0 0;">Federazione Nazionale Associazioni Multiculturali</p>
      <span class="test-badge">TEST MODE</span>
    </div>
    <div class="content">
      <h2>Grazie per la tua affiliazione! (TEST)</h2>
      <p>Caro/a <strong>${existingAffiliation.nome} ${existingAffiliation.cognome}</strong>,</p>
      <p>La tua richiesta di affiliazione a FENAM è stata completata con successo.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Riepilogo affiliazione</h3>
        <p><strong>Nome:</strong> ${existingAffiliation.nome} ${existingAffiliation.cognome}</p>
        <p><strong>Email:</strong> ${existingAffiliation.email}</p>
        <p><strong>ID Ordine:</strong> ${orderID}</p>
        <p><strong>Numero Tessera:</strong> ${updatedAffiliation.memberNumber}</p>
      </div>

      <p><strong>⚠️ NOTA:</strong> Questa è una email di test. Nessun pagamento reale è stato processato.</p>
      
      <p>La tua tessera di affiliazione ti darà accesso a tutti i vantaggi esclusivi riservati ai soci FENAM.</p>
      
      <p>Per qualsiasi domanda o informazione, non esitare a contattarci:</p>
      <ul>
        <li>Email: <a href="mailto:info@fenam.it">info@fenam.it</a></li>
        <li>Visita il nostro sito: <a href="${baseUrl}">${baseUrl}</a></li>
      </ul>

      <p>Grazie ancora per aver scelto di far parte della nostra comunità!</p>
      <p>Cordiali saluti,<br><strong>Il team FENAM</strong></p>
    </div>
  </div>
</body>
</html>
        `

        await resend.emails.send({
          from: process.env.SENDER_EMAIL,
          to: updatedAffiliation.email,
          subject: emailSubject,
          html: htmlContent,
        })

        await prisma.affiliation.update({
          where: { orderId: orderID },
          data: { confirmationEmailSentAt: new Date() },
        })

        emailSent = true
        console.log(
          `✅ [Test Capture] Email di conferma inviata a ${updatedAffiliation.email} per order ${orderID}`
        )
      } catch (emailError) {
        console.error('❌ [Test Capture] Errore invio email:', emailError.message)
      }
    }

    // 5) Invio tessera PDF (idempotente)
    let cardSent = false
    if (
      resend &&
      updatedAffiliation.status === 'completed' &&
      updatedAffiliation.memberNumber &&
      !updatedAffiliation.membershipCardSentAt
    ) {
      try {
        const pdfBuffer = await generateMembershipCardPdf({
          nome: updatedAffiliation.nome,
          cognome: updatedAffiliation.cognome,
          memberNumber: updatedAffiliation.memberNumber,
          memberSince: updatedAffiliation.memberSince,
          memberUntil: updatedAffiliation.memberUntil,
          id: updatedAffiliation.id,
        })

        const pdfBase64 = pdfBuffer.toString('base64')

        await resend.emails.send({
          from: process.env.SENDER_EMAIL,
          to: updatedAffiliation.email,
          subject: 'La tua tessera socio FENAM (TEST)',
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
    .test-badge { background-color: #ff9800; color: white; padding: 5px 10px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #fff; margin: 0;">FENAM</h1>
      <p style="color: #fff; margin: 5px 0 0 0;">Federazione Nazionale Associazioni Multiculturali</p>
      <span class="test-badge">TEST MODE</span>
    </div>
    <div class="content">
      <h2>La tua tessera socio è pronta! (TEST)</h2>
      <p>Caro/a <strong>${updatedAffiliation.nome} ${updatedAffiliation.cognome}</strong>,</p>
      <p>In allegato troverai la tua tessera socio FENAM in formato PDF.</p>
      <p><strong>⚠️ NOTA:</strong> Questa è una tessera di test. Nessun pagamento reale è stato processato.</p>
      <p><strong>Numero tessera:</strong> ${updatedAffiliation.memberNumber}</p>
      <p>Puoi stampare la tessera o conservarla sul tuo dispositivo. La tessera include un QR code per la verifica online.</p>
      <p>Grazie per essere parte della nostra comunità!</p>
      <p>Cordiali saluti,<br><strong>Il team FENAM</strong></p>
    </div>
  </div>
</body>
</html>
          `,
          attachments: [
            {
              filename: `Tessera_FENAM_${updatedAffiliation.memberNumber}.pdf`,
              content: pdfBase64,
              contentType: 'application/pdf',
            },
          ],
        })

        await prisma.affiliation.update({
          where: { orderId: orderID },
          data: { membershipCardSentAt: new Date() },
        })

        cardSent = true
        console.log(
          `✅ [Test Capture] Tessera PDF inviata a ${updatedAffiliation.email} per order ${orderID} (memberNumber: ${updatedAffiliation.memberNumber})`
        )
      } catch (cardError) {
        console.error('❌ [Test Capture] Errore invio tessera PDF:', cardError.message)
      }
    }

    return res.status(200).json({
      ok: true,
      status: 'completed',
      orderID,
      memberNumber: updatedAffiliation.memberNumber,
      memberSince: updatedAffiliation.memberSince,
      memberUntil: updatedAffiliation.memberUntil,
      emailSent,
      cardSent,
      message: 'Capture simulato completato con successo (TEST MODE)',
    })
  } catch (error) {
    console.error('❌ [Test Capture] Errore:', error)
    return res.status(500).json({
      error: 'Errore durante il test capture',
      message: error.message,
    })
  }
}
