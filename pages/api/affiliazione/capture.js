import paypal from '@paypal/checkout-server-sdk'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'
import { completeAffiliation } from '../../../lib/affiliation'
import { checkMethod, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger, logErrorStructured } from '../../../lib/logger'
import { createHandoffToken } from '../../../lib/handoffToken'
import { Resend } from 'resend'
import { generateMembershipCardPdf } from '../../../lib/membershipCardPdf'
import crypto from 'crypto'

// Inizializza Resend (opzionale, non blocca se manca)
let resend = null
const senderEmail = process.env.SENDER_EMAIL || 'noreply@fenam.website'
if (process.env.RESEND_API_KEY && senderEmail) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

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

// Schema di validazione Zod
const captureSchema = z.object({
  orderID: z
    .string()
    .min(1, 'OrderID obbligatorio')
    .transform((val) => val.trim()),
})

export default async function handler(req, res) {
  // Gestione CORS
  if (handleCors(req, res)) {
    return
  }

  // Verifica metodo HTTP
  if (!checkMethod(req, res, ['POST'])) {
    return
  }

  // Rate limiting: 10 richieste/minuto per IP
  const allowed = await rateLimit(req, res)
  if (!allowed) {
    return // rateLimit ha già inviato la risposta 429
  }

  // Verifica PayPal configurato
  if (!client) {
    logger.error('[PayPal Capture] PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET non configurati')
    return sendError(res, 503, 'Service unavailable', 'PayPal non configurato. Contatta il supporto.')
  }

  // Validazione input con Zod
  const parseResult = captureSchema.safeParse(req.body)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return sendError(res, 400, firstError.message || 'Validation error', null, parseResult.error.errors)
  }

  const { orderID } = parseResult.data

  // Genera correlation ID per tracciare il flusso end-to-end
  const correlationId = crypto.randomBytes(8).toString('hex')
  const logContext = { orderID, correlationId }

  try {
    logger.info('[PayPal Capture] Inizio processamento ordine', logContext)

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
    let orderAmount = null // Importo originale dell'ordine

    if (order.purchase_units && order.purchase_units.length > 0) {
      const purchaseUnit = order.purchase_units[0]
      
      // Estrai importo originale dell'ordine
      if (purchaseUnit.amount) {
        orderAmount = purchaseUnit.amount.value || null
      }
      
      if (purchaseUnit.payments?.captures && purchaseUnit.payments.captures.length > 0) {
        const capture = purchaseUnit.payments.captures[0]
        captureId = capture.id || null
        if (capture.amount) {
          amount = capture.amount.value || null
          currency = capture.amount.currency_code || null
        }
      }
    }

    // Validazione importo catturato
    const amountNum = amount ? parseFloat(amount) : null
    if (amountNum !== null && amountNum < 10) {
      logger.warn(`[PayPal Capture] Importo catturato inferiore al minimo: €${amount}`, {
        orderID,
        capturedAmount: amount,
        orderAmount,
      })
      return sendError(res, 400, 'Invalid amount', 'L\'importo catturato è inferiore al minimo richiesto (€10)')
    }

    // Verifica mismatch tra importo ordine e importo catturato
    if (orderAmount && amount) {
      const orderAmountNum = parseFloat(orderAmount)
      const capturedAmountNum = parseFloat(amount)
      const tolerance = 0.01 // Tolleranza per arrotondamenti
      
      if (Math.abs(orderAmountNum - capturedAmountNum) > tolerance) {
        logger.warn(`[PayPal Capture] Mismatch importo: ordine €${orderAmount} vs catturato €${amount}`, {
          orderID,
          orderAmount,
          capturedAmount: amount,
        })
        // Non blocchiamo il processo, ma logghiamo il problema
      }
    }

    // 4) Aggiorna DB (Prisma)
    const existingAffiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
    })

    if (!existingAffiliation) {
      // OrderId non trovato: ritorna 404 (non creiamo record senza dati utente)
      logger.error('[PayPal Capture] OrderId non trovato nel DB', logContext)
      return sendError(res, 404, 'Affiliation not found', 'OrderID non presente nel database. Contatta il supporto.')
    }

    // Verifica se affiliazione è newlyCompleted (status cambia da pending a completed)
    const isNewlyCompleted = existingAffiliation.status !== 'completed'

    // Se già completed, ritorna successo (idempotente) - evita reinvio email/card
    if (!isNewlyCompleted) {
      // Log informativo: verifica stato email/card per tracciabilità
      const emailAlreadySent = !!existingAffiliation.confirmationEmailSentAt
      const cardAlreadySent = !!existingAffiliation.membershipCardSentAt
      
      logger.info('[PayPal Capture] Affiliazione già completata, skip reinvio email/card', {
        orderID,
        affiliationId: existingAffiliation.id,
        emailAlreadySent,
        cardAlreadySent,
        emailSentAt: existingAffiliation.confirmationEmailSentAt?.toISOString() || null,
        cardSentAt: existingAffiliation.membershipCardSentAt?.toISOString() || null,
      })
      
      return sendSuccess(res, {
        ok: true,
        status: 'completed',
        orderID,
        message: 'Affiliazione già completata',
        emailAlreadySent,
        cardAlreadySent,
      })
    }

    // Usa funzione condivisa per completare affiliazione
    // IMPORTANTE: completeAffiliation può fallire per errori DB/Prisma
    // Gestiamo questi errori separatamente dagli errori PayPal
    let completionResult
    try {
      logger.info('[PayPal Capture] Chiamata completeAffiliation', {
        ...logContext,
        affiliationId: existingAffiliation.id,
      })
      
      completionResult = await completeAffiliation({
        affiliationId: existingAffiliation.id,
        payerEmail,
        amount: amount ? parseFloat(amount) : null,
        currency: currency || 'EUR',
        correlationId, // Passa correlation ID per logging interno
      })
      
      logger.info('[PayPal Capture] completeAffiliation completata con successo', {
        ...logContext,
        affiliationId: existingAffiliation.id,
        memberNumber: completionResult.memberNumber || 'non generato',
        emailSent: completionResult.emailSent,
        cardSent: completionResult.cardSent,
      })
    } catch (dbError) {
      // Errore DB/Prisma durante completeAffiliation
      // Questo NON è un errore PayPal, quindi gestiamolo separatamente
      logErrorStructured(
        '[PayPal Capture] Errore DB durante completeAffiliation',
        dbError,
        {
          ...logContext,
          affiliationId: existingAffiliation.id,
          errorType: 'DB_ERROR',
        },
        'DB_CONN'
      )
      
      // IMPORTANTE: PayPal capture è già avvenuto con successo,
      // ma il DB update è fallito. Questo è un caso critico.
      // Ritorniamo errore 500 per indicare problema server-side
      return sendError(
        res,
        500,
        'Database error',
        'Il pagamento è stato completato ma si è verificato un errore durante l\'aggiornamento del database. Contatta il supporto con l\'ID ordine.',
        { orderID, correlationId }
      )
    }

    // Recupera affiliazione aggiornata per risposta
    const updatedAffiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
    })

    // Invio email sempre dopo successo (almeno quando newlyCompleted)
    // Se completeAffiliation non ha inviato email, inviala manualmente con tracciamento
    let emailMessageId = null
    let cardMessageId = null

    if (isNewlyCompleted && resend) {
      // 1) Invio email di conferma se non già inviata
      // Doppio check: completionResult + DB field per sicurezza
      const shouldSendEmail = !completionResult.emailSent && !updatedAffiliation.confirmationEmailSentAt
      
      if (shouldSendEmail) {
        try {
          const emailSubject =
            process.env.AFFILIAZIONE_EMAIL_SUBJECT ||
            'Conferma affiliazione FENAM'

          const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'
          const totalAmount = amountNum
            ? `€${amountNum.toFixed(2)}`
            : '€10,00 (donazione minima)'

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

Caro/a ${updatedAffiliation.nome} ${updatedAffiliation.cognome},

La tua richiesta di affiliazione a FENAM è stata completata con successo.

RIEPILOGO AFFILIAZIONE:
- Nome: ${updatedAffiliation.nome} ${updatedAffiliation.cognome}
- Email: ${updatedAffiliation.email}
- Importo totale: ${totalAmount}
- ID Ordine: ${updatedAffiliation.orderId || 'N/A'}

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

          const emailResponse = await resend.emails.send({
            from: senderEmail,
            to: updatedAffiliation.email,
            subject: emailSubject,
            html: htmlContent,
            text: textContent,
          })

          emailMessageId = emailResponse.data?.id || null

          await prisma.affiliation.update({
            where: { id: updatedAffiliation.id },
            data: { confirmationEmailSentAt: new Date() },
          })

          logger.info('[PayPal Capture] Email di conferma inviata', {
            affiliationId: updatedAffiliation.id,
            email: updatedAffiliation.email,
            resendMessageId: emailMessageId,
          })
        } catch (emailError) {
          logErrorStructured(
            '[PayPal Capture] Errore invio email di conferma',
            emailError,
            {
              affiliationId: updatedAffiliation.id,
              email: updatedAffiliation.email,
              orderID,
            },
            'EMAIL'
          )
          // Non far fallire l'API se Resend fallisce
        }
      } else {
        // Email già inviata: log per tracciabilità
        logger.info('[PayPal Capture] Email di conferma già inviata, skip reinvio', {
          affiliationId: updatedAffiliation.id,
          email: updatedAffiliation.email,
          emailSentAt: updatedAffiliation.confirmationEmailSentAt?.toISOString() || null,
          completionResultEmailSent: completionResult.emailSent,
        })
      }

      // 2) Invio tessera PDF se non già inviata
      // Doppio check: completionResult + DB field + prerequisiti per sicurezza
      const shouldSendCard = 
        !completionResult.cardSent &&
        updatedAffiliation.status === 'completed' &&
        updatedAffiliation.memberNumber &&
        !updatedAffiliation.membershipCardSentAt
      
      if (shouldSendCard) {
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

          const cardResponse = await resend.emails.send({
            from: senderEmail,
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

Caro/a ${updatedAffiliation.nome} ${updatedAffiliation.cognome},

In allegato troverai la tua tessera socio FENAM in formato PDF.

DETTAGLI TESSERA:
- Numero tessera: ${updatedAffiliation.memberNumber}
${updatedAffiliation.memberSince ? `- Valida dal: ${new Date(updatedAffiliation.memberSince).toLocaleDateString('it-IT')}` : ''}
${updatedAffiliation.memberUntil ? `- Valida fino al: ${new Date(updatedAffiliation.memberUntil).toLocaleDateString('it-IT')}` : ''}

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
                filename: `Tessera_FENAM_${updatedAffiliation.memberNumber}.pdf`,
                content: pdfBase64,
                contentType: 'application/pdf',
              },
            ],
          })

          cardMessageId = cardResponse.data?.id || null

          await prisma.affiliation.update({
            where: { id: updatedAffiliation.id },
            data: { membershipCardSentAt: new Date() },
          })

          logger.info('[PayPal Capture] Tessera PDF inviata', {
            affiliationId: updatedAffiliation.id,
            email: updatedAffiliation.email,
            resendMessageId: cardMessageId,
          })
        } catch (cardError) {
          logErrorStructured(
            '[PayPal Capture] Errore invio tessera PDF',
            cardError,
            {
              affiliationId: updatedAffiliation.id,
              email: updatedAffiliation.email,
              orderID,
            },
            'EMAIL'
          )
          // Non far fallire l'API se Resend fallisce
        }
      } else {
        // Card già inviata o prerequisiti mancanti: log per tracciabilità
        logger.info('[PayPal Capture] Tessera PDF già inviata o prerequisiti mancanti, skip reinvio', {
          affiliationId: updatedAffiliation.id,
          email: updatedAffiliation.email,
          cardSentAt: updatedAffiliation.membershipCardSentAt?.toISOString() || null,
          completionResultCardSent: completionResult.cardSent,
          status: updatedAffiliation.status,
          memberNumber: updatedAffiliation.memberNumber || null,
        })
      }
    } else if (!resend) {
      // Resend non configurato: log warn
      logger.warn('[PayPal Capture] Resend non configurato (RESEND_API_KEY o SENDER_EMAIL mancanti), email/card non inviate', {
        affiliationId: updatedAffiliation.id,
        orderID,
        resendApiKeyConfigured: !!process.env.RESEND_API_KEY,
        senderEmailConfigured: !!process.env.SENDER_EMAIL,
      })
    }

    // Log informazioni capture (senza dati sensibili)
    logger.info('[PayPal Capture] Order completato con successo', {
      ...logContext,
      status,
      captureId: captureId ? 'presente' : 'non disponibile',
      amount: amount ? 'presente' : 'non disponibile',
      currency: currency || 'non disponibile',
      memberNumber: updatedAffiliation.memberNumber || 'non generato',
      emailSent: completionResult.emailSent || !!emailMessageId,
      cardSent: completionResult.cardSent || !!cardMessageId,
      emailMessageId: emailMessageId || 'non disponibile',
      cardMessageId: cardMessageId || 'non disponibile',
      affiliationId: updatedAffiliation.id,
    })

    // Verifica se handoff automatico è configurato
    const handoffUrl = process.env.ENOTEMPO_HANDOFF_URL

    if (handoffUrl) {
      try {
        // Genera token per handoff automatico
        const now = Math.floor(Date.now() / 1000)
        const exp = now + 600 // 10 minuti

        const tokenPayload = {
          iss: 'fenam',
          affiliationId: updatedAffiliation.id,
          email: updatedAffiliation.email,
          donation: amountNum || 0,
          orderId: orderID,
          exp: exp,
          nonce: crypto.randomBytes(16).toString('hex'),
        }

        const token = createHandoffToken(tokenPayload)

        // Escape HTML per sicurezza (anche se token è base64url-safe)
        const escapeHtml = (str) => {
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
        }

        // Rispondi con HTML form auto-submit con UX migliorata
        const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reindirizzamento verso Enotempo...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      color: #333;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #8fd1d2;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 {
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
      color: #024230;
    }
    p {
      margin: 0.5rem 0;
      color: #666;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 12px 24px;
      background-color: #12A969;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: background-color 0.3s;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }
    .button:hover {
      background-color: #0f8a55;
    }
    .fallback-link {
      display: block;
      margin-top: 1rem;
      color: #666;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .fallback-link:hover {
      text-decoration: underline;
    }
    #errorMessage {
      display: none;
      color: #d32f2f;
      margin-top: 1rem;
      font-size: 0.9rem;
    }
    #fallbackBox {
      display: none;
      margin-top: 1.5rem;
      padding: 1.5rem;
      background: #e8f5e9;
      border-radius: 8px;
      border-left: 4px solid #12A969;
    }
    #fallbackBox.show {
      display: block;
    }
    #fallbackBox p {
      margin: 0 0 1rem 0;
      color: #2e7d32;
      font-weight: 500;
    }
    #fallbackBox .fallback-links {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    #fallbackBox .fallback-links a {
      display: inline-block;
      padding: 10px 20px;
      background-color: #12A969;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: background-color 0.3s;
    }
    #fallbackBox .fallback-links a:hover {
      background-color: #0f8a55;
    }
    #fallbackBox .fallback-links a.secondary {
      background-color: #8fd1d2;
      color: #024230;
    }
    #fallbackBox .fallback-links a.secondary:hover {
      background-color: #7fc1c2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Reindirizzamento verso Enotempo…</h1>
    <p>Stai per essere reindirizzato automaticamente.</p>
    <p>Se il reindirizzamento non avviene, clicca il pulsante qui sotto.</p>
    
    <form id="handoffForm" method="POST" action="${escapeHtml(handoffUrl)}">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <button type="submit" class="button">Continua verso Enotempo</button>
    </form>
    
    <a href="/supporto" class="fallback-link">Hai bisogno di aiuto? Contatta il supporto</a>
    
    <p id="errorMessage">Si è verificato un errore. <a href="/supporto">Contatta il supporto</a> per assistenza.</p>
    
    <div id="fallbackBox">
      <p>Se Enotempo non si apre, la tua affiliazione è comunque completata su FENAM.</p>
      <div class="fallback-links">
        <a href="/affiliazione">Vai alla pagina Affiliazione</a>
        <a href="/supporto" class="secondary">Contatta il Supporto</a>
      </div>
    </div>
    
    <noscript>
      <div style="margin-top: 1.5rem; padding: 1rem; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404;">
          <strong>JavaScript disabilitato:</strong> Clicca il pulsante "Continua verso Enotempo" per procedere.
        </p>
      </div>
    </noscript>
  </div>
  
  <script>
    (function() {
      try {
        // Auto-submit dopo breve delay per UX migliore
        setTimeout(function() {
          var form = document.getElementById('handoffForm');
          if (form) {
            form.submit();
          }
        }, 500);
        
        // Fallback: se dopo 8-10 secondi non è avvenuto redirect, mostra box informativo
        setTimeout(function() {
          var fallbackBox = document.getElementById('fallbackBox');
          if (fallbackBox) {
            fallbackBox.classList.add('show');
          }
        }, 9000); // 9 secondi (tra 8-10)
        
        // Fallback: se dopo 10 secondi non è avvenuto redirect, mostra anche messaggio errore
        setTimeout(function() {
          var errorMsg = document.getElementById('errorMessage');
          if (errorMsg) {
            errorMsg.style.display = 'block';
          }
        }, 10000);
      } catch (e) {
        // In caso di errore JS, mostra messaggio di errore
        var errorMsg = document.getElementById('errorMessage');
        if (errorMsg) {
          errorMsg.style.display = 'block';
        }
      }
    })();
  </script>
</body>
</html>`

        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.status(200).send(html)
      } catch (tokenError) {
        logger.error('[PayPal Capture] Errore generazione token handoff', {
          orderID,
          error: tokenError.message,
        })
        // Fallback: comportamento normale (JSON)
      }
    } else {
      logger.warn('[PayPal Capture] ENOTEMPO_HANDOFF_URL non configurato, uso comportamento normale')
    }

    // Comportamento normale: risposta JSON
    return sendSuccess(res, {
      ok: true,
      status,
      orderID,
      captureId,
      amount,
      currency,
      memberNumber: updatedAffiliation.memberNumber,
      emailSent: completionResult.emailSent,
      cardSent: completionResult.cardSent,
    })
  } catch (paypalError) {
    // Errore PayPal SDK: log dettagliato (senza esporre secret)
    // Questo catch gestisce SOLO errori dalla chiamata PayPal SDK (riga 81)
    logErrorStructured(
      '[PayPal Capture] Errore PayPal SDK',
      paypalError,
      {
        ...logContext,
        statusCode: paypalError.statusCode,
        errorType: 'PAYPAL_SDK_ERROR',
      },
      'PAYPAL'
    )

    // Se l'errore è specifico (es. order già catturato), possiamo gestirlo meglio
    if (paypalError.statusCode === 422) {
      // 422 = Unprocessable Entity (es. order già catturato o non valido)
      return sendError(
        res,
        502,
        'PayPal error',
        'Ordine non valido o già processato',
        { orderID, correlationId }
      )
    }

    return sendError(
      res,
      502,
      'PayPal error',
      'Errore durante il processamento del pagamento PayPal',
      { orderID, correlationId }
    )
  }
}
