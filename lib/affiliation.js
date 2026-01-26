// lib/affiliation.js
// Funzioni condivise per completare affiliazioni

import crypto from 'crypto'
import { prisma } from './prisma'
import { Resend } from 'resend'
import { generateMembershipCardPdf } from './membershipCardPdf'
import { logger } from './logger'

// Inizializza Resend (opzionale, non blocca se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

/**
 * Genera un numero tessera univoco nel formato FENAM-YYYY-XXXXXX
 * @returns {string} Formato: FENAM-2026-ABC123
 */
export function generateMemberNumber() {
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
export async function generateUniqueMemberNumber(maxRetries = 5) {
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
      logger.warn(
        `[MemberNumber] Collisione rilevata per ${memberNumber}, tentativo ${attempt + 1}/${maxRetries}`
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

/**
 * Completa un'affiliazione: genera memberNumber, imposta date membership,
 * invia email di conferma e tessera PDF.
 * 
 * @param {Object} params
 * @param {string} params.affiliationId - ID interno dell'affiliazione (non orderId)
 * @param {string} [params.payerEmail] - Email PayPal (opzionale, per logica rinnovo)
 * @param {number} [params.amount] - Importo pagato (opzionale, per email)
 * @param {string} [params.currency] - Valuta (opzionale, default: EUR)
 * @returns {Promise<Object>} { memberNumber, emailSent, cardSent }
 */
export async function completeAffiliation({
  affiliationId,
  payerEmail = null,
  amount = null,
  currency = 'EUR',
}) {
  // 1) Recupera affiliazione dal DB
  const affiliation = await prisma.affiliation.findUnique({
    where: { id: affiliationId },
  })

  if (!affiliation) {
    throw new Error(`Affiliazione ${affiliationId} non trovata`)
  }

  // Se già completed E tutti i campi necessari sono presenti, ritorna stato attuale (idempotente)
  if (
    affiliation.status === 'completed' &&
    affiliation.memberNumber &&
    affiliation.memberSince &&
    affiliation.memberUntil
  ) {
    return {
      memberNumber: affiliation.memberNumber,
      emailSent: !!affiliation.confirmationEmailSentAt,
      cardSent: !!affiliation.membershipCardSentAt,
    }
  }

  // Se status è 'completed' ma mancano campi, procedi a completarli
  if (affiliation.status === 'completed') {
    logger.warn(
      `[Complete Affiliation] Status 'completed' ma campi mancanti per affiliation ${affiliationId}, procedo al completamento`
    )
  }

  // 2) LOGICA RINNOVO: Cerca socio esistente con stessa email o payerEmail
  let existingMember = null
  const searchEmail = payerEmail || affiliation.email
  if (searchEmail) {
    existingMember = await prisma.affiliation.findFirst({
      where: {
        AND: [
          { id: { not: affiliation.id } },
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

  // 3) Prepara dati di aggiornamento
  const updateData = {
    status: 'completed',
  }

  // Salva payerEmail solo se diversa da quella del form e se disponibile
  if (payerEmail && payerEmail !== affiliation.email) {
    updateData.payerEmail = payerEmail
  }

  // Imposta membership dates (logica rinnovo)
  const now = new Date()
  let isRenewal = false

  if (existingMember && existingMember.memberUntil) {
    const existingUntil = new Date(existingMember.memberUntil)
    if (existingUntil > now) {
      // Membership ancora attiva: estendi da scadenza attuale
      const oneYearLater = new Date(existingUntil)
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
      updateData.memberUntil = oneYearLater
      updateData.memberSince = existingMember.memberSince || now
      isRenewal = true
      logger.info(
        `[Complete Affiliation] Rinnovo membership: estesa da ${existingUntil.toISOString()} a ${oneYearLater.toISOString()}`
      )
    } else {
      // Membership scaduta: inizia da oggi
      const oneYearLater = new Date(now)
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
      updateData.memberUntil = oneYearLater
      updateData.memberSince = now
      isRenewal = true
      logger.info(
        `[Complete Affiliation] Rinnovo membership scaduta: nuovo periodo da oggi`
      )
    }
  } else {
    // NUOVA MEMBERSHIP: Imposta dates
    updateData.memberSince = now
    const oneYearLater = new Date(now)
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
    updateData.memberUntil = oneYearLater
  }

  // Genera memberNumber se non presente
  if (!affiliation.memberNumber) {
    try {
      updateData.memberNumber = await generateUniqueMemberNumber()
      logger.info(
        `[Complete Affiliation] Generato memberNumber ${updateData.memberNumber} per affiliation ${affiliationId}`
      )
    } catch (memberNumberError) {
      logger.error(
        `[Complete Affiliation] Errore generazione memberNumber per affiliation ${affiliationId}`,
        memberNumberError
      )
      throw memberNumberError
    }
  }

  // 4) Aggiorna DB
  const updatedAffiliation = await prisma.affiliation.update({
    where: { id: affiliationId },
    data: updateData,
  })

  // 5) Invio email di conferma (idempotente: solo se non già inviata)
  let emailSent = false
  if (resend && !updatedAffiliation.confirmationEmailSentAt) {
    try {
      const emailSubject =
        process.env.AFFILIAZIONE_EMAIL_SUBJECT ||
        'Conferma affiliazione FENAM'

      const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'
      const totalAmount = amount
        ? `${amount} ${currency}`
        : '€0,00 (affiliazione gratuita)'

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
      <p>Caro/a <strong>${updatedAffiliation.nome} ${updatedAffiliation.cognome}</strong>,</p>
      <p>La tua richiesta di affiliazione a FENAM è stata completata con successo.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Riepilogo affiliazione</h3>
        <p><strong>Nome:</strong> ${updatedAffiliation.nome} ${updatedAffiliation.cognome}</p>
        <p><strong>Email:</strong> ${updatedAffiliation.email}</p>
        <p><strong>Importo totale:</strong> ${totalAmount}</p>
        <p><strong>ID Ordine:</strong> ${updatedAffiliation.orderId || 'N/A'}</p>
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

      const textContent = `
FENAM - Federazione Nazionale Associazioni Multiculturali

Grazie per la tua affiliazione!

Caro/a ${updatedAffiliation.nome} ${updatedAffiliation.cognome},

La tua richiesta di affiliazione a FENAM è stata completata con successo.

RIEPILOGO AFFILIAZIONE:
- Nome: ${updatedAffiliation.nome} ${updatedAffiliation.cognome}
- Email: ${updatedAffiliation.email}
- Importo totale: ${totalAmount}
- ID Ordine: ${updatedAffiliation.orderId || 'N/A'}

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

      await prisma.affiliation.update({
        where: { id: affiliationId },
        data: { confirmationEmailSentAt: new Date() },
      })

      emailSent = true
      logger.info(
        `[Complete Affiliation] Email di conferma inviata per affiliation ${affiliationId}`
      )
    } catch (emailError) {
      logger.error('[Complete Affiliation] Errore invio email di conferma', emailError, {
        affiliationId,
      })
    }
  } else if (!resend) {
    logger.warn(
      `[Complete Affiliation] Resend non configurato, email di conferma non inviata per affiliation ${affiliationId}`
    )
  } else if (updatedAffiliation.confirmationEmailSentAt) {
    logger.debug(
      `[Complete Affiliation] Email già inviata precedentemente per affiliation ${affiliationId}`
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
        <li>Visita il nostro sito: <a href="${process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'}">${process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'}</a></li>
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
- Sito web: ${process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'}

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

      await prisma.affiliation.update({
        where: { id: affiliationId },
        data: { membershipCardSentAt: new Date() },
      })

      cardSent = true
      logger.info(
        `[Complete Affiliation] Tessera PDF inviata per affiliation ${affiliationId} (memberNumber: ${updatedAffiliation.memberNumber})`
      )
    } catch (cardError) {
      logger.error('[Complete Affiliation] Errore invio tessera PDF', cardError, {
        affiliationId,
        memberNumber: updatedAffiliation.memberNumber || 'non disponibile',
      })
    }
  } else if (!resend) {
    logger.warn(
      `[Complete Affiliation] Resend non configurato, tessera PDF non inviata per affiliation ${affiliationId}`
    )
  } else if (updatedAffiliation.membershipCardSentAt) {
    logger.debug(
      `[Complete Affiliation] Tessera già inviata precedentemente per affiliation ${affiliationId}`
    )
  } else if (!updatedAffiliation.memberNumber) {
    logger.warn(
      `[Complete Affiliation] memberNumber non disponibile, tessera PDF non inviata per affiliation ${affiliationId}`
    )
  }

  return {
    memberNumber: updatedAffiliation.memberNumber,
    emailSent,
    cardSent,
  }
}
