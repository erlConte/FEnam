// lib/affiliation.js
// Funzioni condivise per completare affiliazioni

import crypto from 'crypto'
import { prisma } from './prisma'
import { Resend } from 'resend'
import { generateMembershipCardPdf } from './membershipCardPdf'
import { logger, maskEmail, logErrorStructured } from './logger'

// Inizializza Resend (opzionale, non blocca se manca)
let resend = null
const senderEmail = process.env.SENDER_EMAIL || 'noreply@fenam.website'
if (process.env.RESEND_API_KEY && senderEmail) {
  resend = new Resend(process.env.RESEND_API_KEY)
} else if (!process.env.SENDER_EMAIL) {
  logger.warn('[Affiliation] SENDER_EMAIL non configurato, usando fallback noreply@fenam.website')
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
 * Marca un'affiliazione come completata nel DB (OPERAZIONE CRITICA - payment-first)
 * Questa funzione deve completare SEMPRE dopo PayPal capture success.
 * NON include side effects (email/PDF) che possono fallire.
 * 
 * @param {Object} params
 * @param {string} params.affiliationId - ID interno dell'affiliazione
 * @param {string} [params.payerEmail] - Email PayPal (opzionale)
 * @param {string} [params.correlationId] - Correlation ID per logging
 * @returns {Promise<Object>} { memberNumber, memberSince, memberUntil }
 */
export async function markAffiliationCompleted({
  affiliationId,
  payerEmail = null,
  correlationId = null,
}) {
  const logContext = { 
    affiliationId, 
    correlationId: correlationId || 'local',
    payerEmail: payerEmail ? maskEmail(payerEmail) : null,
  }

  // 1) Recupera affiliazione dal DB
  let affiliation
  try {
    affiliation = await prisma.affiliation.findUnique({
      where: { id: affiliationId },
    })
  } catch (dbError) {
    logger.error('[Mark Completed] Errore DB durante findUnique', dbError, logContext)
    throw new Error(`Errore database durante recupero affiliazione: ${dbError.message}`)
  }

  if (!affiliation) {
    logger.error('[Mark Completed] Affiliazione non trovata', logContext)
    throw new Error(`Affiliazione ${affiliationId} non trovata`)
  }

  // 2) Se già completed con tutti i campi necessari, ritorna stato attuale (idempotente)
  if (
    affiliation.status === 'completed' &&
    affiliation.memberNumber &&
    affiliation.memberSince &&
    affiliation.memberUntil
  ) {
    logger.info('[Mark Completed] Affiliazione già completata, ritorno stato esistente', {
      ...logContext,
      memberNumber: affiliation.memberNumber,
    })
    return {
      memberNumber: affiliation.memberNumber,
      memberSince: affiliation.memberSince,
      memberUntil: affiliation.memberUntil,
    }
  }

  // 3) LOGICA RINNOVO: Cerca socio esistente con stessa email o payerEmail
  let existingMember = null
  const searchEmail = payerEmail || affiliation.email
  if (searchEmail) {
    try {
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
    } catch (dbError) {
      logger.error('[Mark Completed] Errore ricerca membro esistente', dbError, logContext)
      // Non bloccare: procediamo come nuova membership
    }
  }

  // 4) Prepara dati di aggiornamento
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
        `[Mark Completed] Rinnovo membership: estesa da ${existingUntil.toISOString()} a ${oneYearLater.toISOString()}`,
        logContext
      )
    } else {
      // Membership scaduta: inizia da oggi
      const oneYearLater = new Date(now)
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
      updateData.memberUntil = oneYearLater
      updateData.memberSince = now
      isRenewal = true
      logger.info(
        `[Mark Completed] Rinnovo membership scaduta: nuovo periodo da oggi`,
        logContext
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
        `[Mark Completed] Generato memberNumber ${updateData.memberNumber}`,
        logContext
      )
    } catch (memberNumberError) {
      logger.error(
        `[Mark Completed] Errore generazione memberNumber`,
        memberNumberError,
        logContext
      )
      throw memberNumberError
    }
  }

  // 5) Aggiorna DB - OPERAZIONE CRITICA: usa transazione per atomicità
  let updatedAffiliation
  try {
    logger.info('[Mark Completed] Aggiornamento DB con status completed', {
      ...logContext,
      updateDataKeys: Object.keys(updateData),
      memberNumber: updateData.memberNumber || 'non generato',
    })
    
    // Usa transazione per garantire atomicità
    updatedAffiliation = await prisma.$transaction(async (tx) => {
      // Verifica che status non sia già completed (race condition protection)
      const current = await tx.affiliation.findUnique({
        where: { id: affiliationId },
        select: { status: true, memberNumber: true },
      })
      
      if (current?.status === 'completed' && current?.memberNumber) {
        // Già completata da un'altra richiesta: ritorna esistente
        return await tx.affiliation.findUnique({
          where: { id: affiliationId },
        })
      }
      
      return await tx.affiliation.update({
        where: { id: affiliationId },
        data: updateData,
      })
    })
    
    logger.info('[Mark Completed] DB aggiornato con successo', {
      ...logContext,
      status: updatedAffiliation.status,
      memberNumber: updatedAffiliation.memberNumber || 'non generato',
    })
  } catch (dbError) {
    // Errore critico: DB update fallito
    // Questo è il punto dove l'affiliazione DOVREBBE cambiare da pending a completed
    logger.error('[Mark Completed] ERRORE CRITICO: DB update fallito', dbError, {
      ...logContext,
      updateDataKeys: Object.keys(updateData),
      prismaErrorCode: dbError.code || 'UNKNOWN',
      prismaErrorMeta: dbError.meta || null,
    })
    
    // Rilanciamo con contesto aggiuntivo per permettere al chiamante di gestire l'errore
    const errorMessage = dbError.code === 'P2025'
      ? `Affiliazione ${affiliationId} non trovata durante update`
      : dbError.code === 'P2002'
      ? `Violazione unique constraint (probabile collisione memberNumber)`
      : `Errore database durante aggiornamento affiliazione: ${dbError.message}`
    
    throw new Error(errorMessage)
  }

  return {
    memberNumber: updatedAffiliation.memberNumber,
    memberSince: updatedAffiliation.memberSince,
    memberUntil: updatedAffiliation.memberUntil,
  }
}

/**
 * Esegue side effects non bloccanti (email e PDF)
 * Questa funzione NON deve mai fallire in modo che blocchi il completion.
 * 
 * @param {Object} params
 * @param {string} params.affiliationId - ID interno dell'affiliazione
 * @param {number} [params.amount] - Importo pagato (opzionale, per email)
 * @param {string} [params.currency] - Valuta (opzionale, default: EUR)
 * @param {string} [params.correlationId] - Correlation ID per logging
 * @returns {Promise<Object>} { emailSent, cardSent, warnings }
 */
export async function runAffiliationSideEffects({
  affiliationId,
  orderId = null,
  amount = null,
  currency = 'EUR',
  correlationId = null,
}) {
  const logContext = { 
    affiliationId, 
    orderId: orderId ?? 'n/a',
    correlationId: correlationId || 'local' 
  }

  // Recupera affiliazione aggiornata
  let affiliation
  try {
    affiliation = await prisma.affiliation.findUnique({
      where: { id: affiliationId },
    })
  } catch (dbError) {
    logErrorStructured('[Side Effects] Errore DB durante findUnique', dbError, logContext, 'DB_CONN')
    return { emailSent: false, cardSent: false, warnings: ['Errore DB durante recupero affiliazione'] }
  }

  if (!affiliation || affiliation.status !== 'completed') {
    logger.warn('[Side Effects] Affiliazione non trovata o non completata', logContext)
    return { emailSent: false, cardSent: false, warnings: ['Affiliazione non completata'] }
  }

  const warnings = []
  let emailSent = false
  let cardSent = false

  // 1) Invio email di conferma (idempotente: solo se non già inviata)
  if (resend && !affiliation.confirmationEmailSentAt) {
    try {
      const emailSubject =
        process.env.AFFILIAZIONE_EMAIL_SUBJECT ||
        'Conferma affiliazione FENAM'

      const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'
      const totalAmount = amount != null && amount > 0
        ? `€${amount.toFixed(2)}`
        : 'Affiliazione gratuita'

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
      <p>Caro/a <strong>${affiliation.nome} ${affiliation.cognome}</strong>,</p>
      <p>La tua richiesta di affiliazione a FENAM è stata completata con successo.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Riepilogo affiliazione</h3>
        <p><strong>Nome:</strong> ${affiliation.nome} ${affiliation.cognome}</p>
        <p><strong>Email:</strong> ${affiliation.email}</p>
        <p><strong>Importo totale:</strong> ${totalAmount}</p>
        <p><strong>ID Ordine:</strong> ${affiliation.orderId || 'N/A'}</p>
      </div>

      <p>La tua tessera di affiliazione ti darà accesso a tutti i vantaggi esclusivi riservati ai soci FENAM.</p>
      
      <p>Per qualsiasi domanda o informazione, non esitare a contattarci:</p>
      <ul>
        <li>Email: <a href="mailto:${process.env.CONTACT_EMAIL || 'info@fenam.website'}">${process.env.CONTACT_EMAIL || 'info@fenam.website'}</a></li>
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

Caro/a ${affiliation.nome} ${affiliation.cognome},

La tua richiesta di affiliazione a FENAM è stata completata con successo.

RIEPILOGO AFFILIAZIONE:
- Nome: ${affiliation.nome} ${affiliation.cognome}
- Email: ${affiliation.email}
- Importo totale: ${totalAmount}
- ID Ordine: ${affiliation.orderId || 'N/A'}

La tua tessera di affiliazione ti darà accesso a tutti i vantaggi esclusivi riservati ai soci FENAM.

Per qualsiasi domanda o informazione:
- Email: ${process.env.CONTACT_EMAIL || 'info@fenam.website'}
- Sito web: ${baseUrl}

Grazie ancora per aver scelto di far parte della nostra comunità!

Cordiali saluti,
Il team FENAM

---
FENAM - Federazione Nazionale Associazioni Multiculturali
Questa email è stata inviata automaticamente. Si prega di non rispondere.
      `.trim()

      await resend.emails.send({
        from: senderEmail,
        to: affiliation.email,
        subject: emailSubject,
        html: htmlContent,
        text: textContent,
      })

      // Aggiorna DB SOLO se email inviata con successo
      await prisma.affiliation.update({
        where: { id: affiliationId },
        data: { confirmationEmailSentAt: new Date() },
      })

      emailSent = true
      logger.info('[Side Effects] Email di conferma inviata', {
        ...logContext,
        email: maskEmail(affiliation.email),
      })
    } catch (emailError) {
      logErrorStructured('[Side Effects] Errore invio email di conferma', emailError, {
        ...logContext,
        email: maskEmail(affiliation.email),
      }, 'EMAIL')
      warnings.push('Email di conferma non inviata (errore tecnico)')
    }
  } else if (!resend) {
    logger.warn('[Side Effects] Resend non configurato, email di conferma non inviata', logContext)
    warnings.push('Servizio email non configurato')
  } else if (affiliation.confirmationEmailSentAt) {
    logger.debug(
      `[Side Effects] Email già inviata precedentemente per affiliation ${affiliationId}`
    )
    emailSent = true // Considera già inviata
  }

  // 2) Invio tessera PDF (idempotente: solo se non già inviata)
  if (
    resend &&
    affiliation.status === 'completed' &&
    affiliation.memberNumber &&
    !affiliation.membershipCardSentAt
  ) {
    try {
      const pdfBuffer = await generateMembershipCardPdf({
        nome: affiliation.nome,
        cognome: affiliation.cognome,
        memberNumber: affiliation.memberNumber,
        memberSince: affiliation.memberSince,
        memberUntil: affiliation.memberUntil,
        id: affiliation.id,
      })

      const pdfBase64 = pdfBuffer.toString('base64')

      await resend.emails.send({
        from: senderEmail,
        to: affiliation.email,
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
      <p>Caro/a <strong>${affiliation.nome} ${affiliation.cognome}</strong>,</p>
      <p>In allegato troverai la tua tessera socio FENAM in formato PDF.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Dettagli tessera</h3>
        <p><strong>Numero tessera:</strong> ${affiliation.memberNumber}</p>
        ${affiliation.memberSince ? `<p><strong>Valida dal:</strong> ${new Date(affiliation.memberSince).toLocaleDateString('it-IT')}</p>` : ''}
        ${affiliation.memberUntil ? `<p><strong>Valida fino al:</strong> ${new Date(affiliation.memberUntil).toLocaleDateString('it-IT')}</p>` : ''}
      </div>

      <p>Puoi stampare la tessera o conservarla sul tuo dispositivo. La tessera include un QR code per la verifica online.</p>
      
      <p>Per qualsiasi domanda o informazione:</p>
      <ul>
        <li>Email: <a href="mailto:${process.env.CONTACT_EMAIL || 'info@fenam.website'}">${process.env.CONTACT_EMAIL || 'info@fenam.website'}</a></li>
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

Caro/a ${affiliation.nome} ${affiliation.cognome},

In allegato troverai la tua tessera socio FENAM in formato PDF.

DETTAGLI TESSERA:
- Numero tessera: ${affiliation.memberNumber}
${affiliation.memberSince ? `- Valida dal: ${new Date(affiliation.memberSince).toLocaleDateString('it-IT')}` : ''}
${affiliation.memberUntil ? `- Valida fino al: ${new Date(affiliation.memberUntil).toLocaleDateString('it-IT')}` : ''}

Puoi stampare la tessera o conservarla sul tuo dispositivo. La tessera include un QR code per la verifica online.

Per qualsiasi domanda o informazione:
- Email: ${process.env.CONTACT_EMAIL || 'info@fenam.website'}
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
            filename: `Tessera_FENAM_${affiliation.memberNumber}.pdf`,
            content: pdfBase64,
            contentType: 'application/pdf',
          },
        ],
      })

      // Aggiorna DB SOLO se PDF inviato con successo
      await prisma.affiliation.update({
        where: { id: affiliationId },
        data: { membershipCardSentAt: new Date() },
      })

      cardSent = true
      logger.info('[Side Effects] Tessera PDF inviata', {
        ...logContext,
        memberNumber: affiliation.memberNumber,
        email: maskEmail(affiliation.email),
      })
    } catch (cardError) {
      logErrorStructured('[Side Effects] Errore invio tessera PDF', cardError, {
        ...logContext,
        memberNumber: affiliation.memberNumber || 'non disponibile',
        email: maskEmail(affiliation.email),
      }, 'PDF')
      warnings.push('Tessera PDF non inviata (errore tecnico)')
    }
  } else if (!resend) {
    logger.warn('[Side Effects] Resend non configurato, tessera PDF non inviata', logContext)
    if (!warnings.includes('Servizio email non configurato')) {
      warnings.push('Servizio email non configurato')
    }
  } else if (affiliation.membershipCardSentAt) {
    logger.debug(
      `[Side Effects] Tessera già inviata precedentemente per affiliation ${affiliationId}`
    )
    cardSent = true // Considera già inviata
  } else if (!affiliation.memberNumber) {
    logger.warn('[Side Effects] memberNumber non disponibile, tessera PDF non inviata', logContext)
    warnings.push('MemberNumber non disponibile')
  }

  return { emailSent, cardSent, warnings }
}

/**
 * Completa un'affiliazione: marca come completed e esegue side effects
 * DEPRECATO: Usa markAffiliationCompleted + runAffiliationSideEffects separatamente
 * Mantenuto per retrocompatibilità
 * 
 * @param {Object} params
 * @param {string} params.affiliationId - ID interno dell'affiliazione (non orderId)
 * @param {string} [params.payerEmail] - Email PayPal (opzionale, per logica rinnovo)
 * @param {number} [params.amount] - Importo pagato (opzionale, per email)
 * @param {string} [params.currency] - Valuta (opzionale, default: EUR)
 * @param {string} [params.correlationId] - Correlation ID per logging (opzionale)
 * @returns {Promise<Object>} { memberNumber, emailSent, cardSent }
 */
export async function completeAffiliation({
  affiliationId,
  payerEmail = null,
  amount = null,
  currency = 'EUR',
  correlationId = null,
}) {
  // 1) Marca come completed (CRITICO - deve sempre completare)
  const dbResult = await markAffiliationCompleted({
    affiliationId,
    payerEmail,
    correlationId,
  })

  // 2) Esegui side effects (NON bloccanti)
  const sideEffectsResult = await runAffiliationSideEffects({
    affiliationId,
    amount,
    currency,
    correlationId,
  })

  return {
    memberNumber: dbResult.memberNumber,
    emailSent: sideEffectsResult.emailSent,
    cardSent: sideEffectsResult.cardSent,
  }
}
