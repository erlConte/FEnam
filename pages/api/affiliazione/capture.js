import paypal from '@paypal/checkout-server-sdk'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'
import { markAffiliationCompleted, runAffiliationSideEffects } from '../../../lib/affiliation'
import { checkMethod, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger, logErrorStructured, getCorrelationId } from '../../../lib/logger'
import { createPayPalClient, getPayPalBaseUrl, isPayPalLive } from '../../../lib/paypalEnv'
import { createHandoffToken } from '../../../lib/handoffToken'
import crypto from 'crypto'

// Resend non più necessario qui: gestito in lib/affiliation.js

// Inizializza PayPal client (stesso env di paypal.js: PAYPAL_ENV / NODE_ENV, base URL in log)
const { client } = createPayPalClient()

// Schema: orderID obbligatorio (fonte primaria); nome/cognome/email/telefono/privacy opzionali solo per recovery se record non in DB.
// TODO P1: Se PayPal richiede allowlist IP è setting account; in serverless non controlli facilmente IP.
const captureSchema = z.object({
  orderID: z
    .string()
    .min(1, 'OrderID obbligatorio')
    .transform((val) => val.trim()),
  nome: z.string().trim().min(2).max(80).optional(),
  cognome: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().max(200).optional(),
  telefono: z.string().trim().max(25).optional(),
  privacy: z.boolean().optional(),
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
    logger.warn('[PayPal Capture] Validazione fallita', {
      orderID: req.body?.orderID ? 'presente' : 'mancante',
      category: 'VALIDATION',
    })
    return sendError(res, 400, firstError.message || 'Validation error', null, parseResult.error.errors)
  }

  const { orderID, nome: bodyNome, cognome: bodyCognome, email: bodyEmail, telefono: bodyTelefono, privacy: bodyPrivacy } = parseResult.data

  // Estrai correlation ID da header o genera uno nuovo
  const correlationId = getCorrelationId(req)
  const logContext = { orderID, correlationId }

  // Log SEMPRE: route hit, paypalBaseUrl, paypalMode, orderID, correlationId (senza segreti)
  const paypalBaseUrl = getPayPalBaseUrl()
  const paypalMode = isPayPalLive() ? 'live' : 'sandbox'
  logger.info('[PayPal Capture] route hit', {
    ...logContext,
    paypalBaseUrl,
    paypalMode,
  })

  // Flusso esplicito: 1) Capture ordine (o GET se già catturato) 2) Se COMPLETED: aggiorna DB (idempotente) 3) Side effects (PDF + email) 4) Handoff se configurato
  let order
  try {
    logger.info('[PayPal Capture] Step 1: PayPal capture', { ...logContext, paypalBaseUrl, paypalMode })
    const captureRequest = new paypal.orders.OrdersCaptureRequest(orderID)
    const captureResponse = await client.execute(captureRequest)
    order = captureResponse.result
  } catch (captureErr) {
    // Ordine già catturato? GET e sincronizza (idempotente)
    const isAlreadyCaptured =
      captureErr.statusCode === 422 ||
      (captureErr.message && String(captureErr.message).toUpperCase().includes('ORDER_ALREADY_CAPTURED'))
    if (isAlreadyCaptured) {
      try {
        const getRequest = new paypal.orders.OrdersGetRequest(orderID)
        const getResponse = await client.execute(getRequest)
        order = getResponse.result
        if (order.status !== 'COMPLETED') {
          logger.warn('[PayPal Capture] GET order after already-captured: status non COMPLETED', {
            orderID,
            correlationId,
            paypalStatus: order.status || 'UNKNOWN',
          })
          return sendError(res, 502, 'PayPal error', 'Ordine non completato su PayPal.', { orderID, correlationId })
        }
        logger.info('[PayPal Capture] Ordine già catturato, sincronizzo da GET', {
          orderID,
          correlationId,
          paypalStatus: order.status,
        })
      } catch (getErr) {
        logErrorStructured('[PayPal Capture] GET order fallito dopo capture error', getErr, logContext, 'PAYPAL_API')
        return sendError(res, 502, 'PayPal error', 'Errore durante verifica ordine PayPal.', { orderID, correlationId })
      }
    } else {
      logErrorStructured('[PayPal Capture] Errore PayPal SDK', captureErr, {
        ...logContext,
        statusCode: captureErr.statusCode,
      }, 'PAYPAL_API')
      return sendError(res, 502, 'PayPal error', 'Errore durante il processamento del pagamento PayPal.', {
        orderID,
        correlationId,
      })
    }
  }

  const status = order.status || 'UNKNOWN'
  const reason = order.details?.[0]?.issue || order.message || null
  const debugId = order.debug_id ?? order.details?.[0]?.debug_id ?? null
  logger.info('[PayPal Capture] PayPal response', {
    orderID,
    correlationId,
    paypalBaseUrl,
    paypalMode,
    paypalStatus: status,
    ...(reason && { reason }),
    ...(debugId && { debug_id: debugId }),
  })

  // Se PayPal non ha restituito COMPLETED: non completare affiliazione, salva debug e ritorna 200 con messaggio
  if (status !== 'COMPLETED') {
      const existingForDebug = await prisma.affiliation.findUnique({
        where: { orderId: orderID },
        select: { id: true },
      })
      if (existingForDebug) {
        await prisma.affiliation.update({
          where: { id: existingForDebug.id },
          data: { lastPaypalStatus: status, lastPaypalCheckedAt: new Date() },
        })
      }
      logger.warn('[PayPal Capture] Pagamento non COMPLETED, non si chiama markAffiliationCompleted', {
        orderID,
        correlationId,
        paypalStatus: status,
      })
      return sendSuccess(res, {
        ok: true,
        paypalStatus: status,
        correlationId,
        message: `Pagamento non completato: stato = ${status}. PayPal sta processando, riprova tra qualche minuto.`,
      })
    }

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
      return sendError(res, 400, 'Invalid amount', 'Importo minimo 10€')
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

    // ============================================
    // STEP 2: Verifica affiliazione nel DB (o recovery se mancante)
    // ============================================
    let existingAffiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
    })

    if (!existingAffiliation) {
      // Fallback: pagamento COMPLETED ma record non creato in paypal.js (es. errore DB) → crea affiliation "recovered"
      // Usa solo dati body validi; altrimenti N/D per evitare dati finti
      const hasValidEmail = (v) => typeof v === 'string' && v.trim().length >= 5 && v.includes('@')
      const recoveryNome = bodyNome && bodyNome.trim().length >= 2 ? bodyNome.trim().slice(0, 80) : 'N/D'
      const recoveryCognome = bodyCognome && bodyCognome.trim().length >= 2 ? bodyCognome.trim().slice(0, 80) : 'N/D'
      const recoveryEmail = (bodyEmail && hasValidEmail(bodyEmail)) ? bodyEmail.trim().toLowerCase() : (payerEmail || 'N/D')
      const recoveryTelefono = bodyTelefono && bodyTelefono.trim().length >= 1 ? bodyTelefono.trim().slice(0, 25) : 'N/D'
      const recoveryPrivacy = bodyPrivacy !== false

      try {
        existingAffiliation = await prisma.affiliation.create({
          data: {
            orderId: orderID,
            nome: recoveryNome,
            cognome: recoveryCognome,
            email: recoveryEmail,
            telefono: recoveryTelefono,
            privacy: recoveryPrivacy,
            status: 'pending',
          },
        })
        logger.warn('[PayPal Capture] Affiliation recovered: orderId non in DB, creato record da capture', {
          orderID,
          correlationId,
          affiliationId: existingAffiliation.id,
        })
      } catch (createErr) {
        // Anti-duplicati: due capture concorrenti → P2002 su orderId, ricarica record
        if (createErr.code === 'P2002' && createErr.meta?.target?.includes('orderId')) {
          const found = await prisma.affiliation.findUnique({ where: { orderId: orderID } })
          if (found) {
            existingAffiliation = found
            logger.info('[PayPal Capture] Affiliation già creata da altra richiesta (P2002), uso record esistente', {
              orderID,
              correlationId,
            })
          } else {
            logErrorStructured('[PayPal Capture] Errore recovery: P2002 ma record non trovato', createErr, logContext, 'DB_CONN')
            return sendError(res, 500, 'Database error', 'Errore durante il recupero. Riprova o contatta il supporto.', { orderID, correlationId })
          }
        } else {
          logErrorStructured('[PayPal Capture] Errore recovery: creazione affiliation fallita', createErr, logContext, 'DB_CONN')
          return sendError(res, 500, 'Database error', 'OrderID non presente nel database. Contatta il supporto con l\'ID ordine.', { orderID, correlationId })
        }
      }
    }

    // Verifica se affiliazione è già completed (idempotenza)
    const isNewlyCompleted = existingAffiliation.status !== 'completed'

    if (!isNewlyCompleted) {
      logger.info('[PayPal Capture] Affiliazione già completata (idempotente)', {
        ...logContext,
        affiliationId: existingAffiliation.id,
        dbStatusBefore: existingAffiliation.status,
        memberNumber: existingAffiliation.memberNumber,
        emailSent: !!existingAffiliation.confirmationEmailSentAt,
        cardSent: !!existingAffiliation.membershipCardSentAt,
      })
      return sendSuccess(res, {
        ok: true,
        already_completed: true,
        status: 'completed',
        orderID,
        message: 'Affiliazione già completata',
        memberNumber: existingAffiliation.memberNumber,
        emailSent: !!existingAffiliation.confirmationEmailSentAt,
        cardSent: !!existingAffiliation.membershipCardSentAt,
      })
    }

    // STEP 3: DB Update - CRITICO (payment-first). Idempotente: non rollback se side effects falliscono.
    const dbStatusBefore = existingAffiliation.status
    let dbResult
    try {
      logger.info('[PayPal Capture] Step 3: Marca affiliazione completed', {
        ...logContext,
        affiliationId: existingAffiliation.id,
        dbStatusBefore,
      })
      
      dbResult = await markAffiliationCompleted({
        affiliationId: existingAffiliation.id,
        payerEmail,
        correlationId,
      })
      
      logger.info('[PayPal Capture] DB aggiornato con successo', {
        ...logContext,
        affiliationId: existingAffiliation.id,
        memberNumber: dbResult.memberNumber,
      })

      // Riepilogo stato DB dopo markCompleted (log completo solo in debug)
      const afterMark = await prisma.affiliation.findUnique({
        where: { orderId: orderID },
        select: {
          status: true,
          memberNumber: true,
          memberSince: true,
          memberUntil: true,
          confirmationEmailSentAt: true,
          membershipCardSentAt: true,
        },
      })
      logger.info('[PayPal Capture] Stato DB dopo markCompleted', {
        orderID,
        correlationId,
        affiliationId: existingAffiliation.id,
        dbStatusBefore,
        dbStatusAfter: afterMark?.status ?? null,
        memberNumber: afterMark?.memberNumber ?? null,
      })
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug('[PayPal Capture] Stato DB (debug)', {
          orderID,
          memberSince: afterMark?.memberSince?.toISOString() ?? null,
          memberUntil: afterMark?.memberUntil?.toISOString() ?? null,
          confirmationEmailSentAt: afterMark?.confirmationEmailSentAt?.toISOString() ?? null,
          membershipCardSentAt: afterMark?.membershipCardSentAt?.toISOString() ?? null,
        })
      }
    } catch (dbError) {
      logErrorStructured(
        '[PayPal Capture] ERRORE CRITICO: DB update fallito dopo PayPal capture',
        dbError,
        {
          ...logContext,
          affiliationId: existingAffiliation.id,
          dbStatusBefore,
        },
        'DB_CONN'
      )
      // Salva su DB che PayPal era COMPLETED (per recovery/debug): usiamo colonne esistenti
      try {
        await prisma.affiliation.update({
          where: { id: existingAffiliation.id },
          data: { lastPaypalStatus: 'COMPLETED', lastPaypalCheckedAt: new Date() },
        })
      } catch (updateDebugErr) {
        logger.warn('[PayPal Capture] Impossibile salvare lastPaypalStatus per recovery', {
          orderID,
          correlationId,
          affiliationId: existingAffiliation.id,
        })
      }
      return sendError(
        res,
        500,
        'Database error',
        'Il pagamento è stato completato ma si è verificato un errore durante l\'aggiornamento del database. Contatta il supporto con l\'ID ordine.',
        { orderID, correlationId }
      )
    }

    // ============================================
    // STEP 4: Side Effects NON bloccanti (email/PDF)
    // ============================================
    // Questi NON devono mai bloccare il completion
    let sideEffectsResult = { emailSent: false, cardSent: false, warnings: [] }
    try {
      logger.info('[PayPal Capture] Esecuzione side effects (email/PDF)', {
        ...logContext,
        affiliationId: existingAffiliation.id,
      })
      
      sideEffectsResult = await runAffiliationSideEffects({
        affiliationId: existingAffiliation.id,
        orderId: orderID,
        amount: amountNum,
        currency: currency || 'EUR',
        correlationId,
      })
      
      if (sideEffectsResult.warnings.length > 0) {
        logger.warn('[PayPal Capture] Side effects completati con warnings', {
          ...logContext,
          warnings: sideEffectsResult.warnings,
        })
      } else {
        logger.info('[PayPal Capture] Side effects completati con successo', {
          ...logContext,
          emailSent: sideEffectsResult.emailSent,
          cardSent: sideEffectsResult.cardSent,
        })
      }
    } catch (sideEffectsError) {
      // Side effects falliti: logga ma NON bloccare
      logErrorStructured(
        '[PayPal Capture] Errore side effects (non bloccante)',
        sideEffectsError,
        {
          ...logContext,
          affiliationId: existingAffiliation.id,
          errorType: 'SIDE_EFFECTS_ERROR',
        },
        'EMAIL'
      )
      sideEffectsResult.warnings.push('Errore durante invio email/tessera')
    }

    // Recupera affiliazione aggiornata per risposta
    const updatedAffiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
    })

    // ============================================
    // STEP 5: Risposta finale
    // ============================================

    const handoffSent = !!process.env.ENOTEMPO_HANDOFF_URL
    logger.info('[PayPal Capture] Order completato con successo', {
      ...logContext,
      paypalStatus: status,
      affiliationId: updatedAffiliation.id,
      dbStatusAfter: updatedAffiliation.status ?? null,
      pdfGenerated: sideEffectsResult.cardSent,
      emailSent: sideEffectsResult.emailSent,
      handoffSent,
      memberNumber: dbResult.memberNumber || 'non generato',
      warnings: sideEffectsResult.warnings.length > 0 ? sideEffectsResult.warnings : undefined,
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

    // Risposta JSON con warnings se presenti
    const response = {
      ok: true,
      status,
      orderID,
      captureId,
      amount,
      currency,
      memberNumber: dbResult.memberNumber,
      emailSent: sideEffectsResult.emailSent,
      cardSent: sideEffectsResult.cardSent,
      correlationId,
    }
    
    // Aggiungi warnings se presenti (non bloccanti)
    if (sideEffectsResult.warnings.length > 0) {
      response.warnings = sideEffectsResult.warnings
    }
    
    return sendSuccess(res, response)
}
