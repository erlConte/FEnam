// pages/api/affiliazione/capture.js

import paypal from '@paypal/checkout-server-sdk'
import { z } from 'zod'
import crypto from 'crypto'

import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'
import { markAffiliationCompleted, runAffiliationSideEffects } from '../../../lib/affiliation'
import { checkMethod, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger, logErrorStructured, getCorrelationId } from '../../../lib/logger'
import { createPayPalClient, getPayPalBaseUrl, isPayPalLive } from '../../../lib/paypalEnv'
import { createHandoffToken } from '../../../lib/handoffToken'

// Inizializza PayPal client
const { client } = createPayPalClient()

// Schema: orderID obbligatorio; altri campi opzionali solo per recovery (se manca record DB)
const captureSchema = z.object({
  orderID: z.string().min(1, 'OrderID obbligatorio').transform((v) => v.trim()),
  nome: z.string().trim().min(2).max(80).optional(),
  cognome: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().max(200).optional(),
  telefono: z.string().trim().max(25).optional(),
  privacy: z.boolean().optional(),
})

// Helpers
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isOrderAlreadyCaptured(err) {
  const msg = err?.message ? String(err.message).toUpperCase() : ''
  return err?.statusCode === 422 || msg.includes('ORDER_ALREADY_CAPTURED')
}

function isValidEmail(v) {
  return typeof v === 'string' && v.trim().length >= 5 && v.includes('@')
}

function detectWantsJson(req) {
  const accept = String(req.headers.accept || '')
  const xrw = String(req.headers['x-requested-with'] || '')
  const contentType = String(req.headers['content-type'] || '')

  // Fetch spesso manda Accept: */*, quindi controlliamo anche content-type e X-Requested-With
  return (
    accept.includes('application/json') ||
    contentType.includes('application/json') ||
    xrw.toLowerCase() === 'xmlhttprequest'
  )
}

function renderHandoffHtml(handoffUrl, token) {
  const safeUrl = escapeHtml(handoffUrl)
  const safeToken = escapeHtml(token)

  return `<!DOCTYPE html>
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
      max-width: 420px;
      width: 92%;
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
    @keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
    h1 { margin: 0 0 1rem 0; font-size: 1.4rem; color: #024230; }
    p { margin: 0.5rem 0; color: #666; line-height: 1.6; }
    .button {
      display: inline-block;
      margin-top: 1.2rem;
      padding: 12px 24px;
      background-color: #12A969;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 700;
      transition: background-color 0.3s;
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }
    .button:hover { background-color: #0f8a55; }
    .fallback-link { display: block; margin-top: 1rem; color: #666; text-decoration: none; font-size: 0.9rem; }
    .fallback-link:hover { text-decoration: underline; }
    #fallbackBox {
      display: none;
      margin-top: 1.2rem;
      padding: 1rem;
      background: #e8f5e9;
      border-radius: 8px;
      border-left: 4px solid #12A969;
      text-align: left;
    }
    #fallbackBox.show { display: block; }
    #fallbackBox p { margin: 0; color: #2e7d32; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Reindirizzamento verso Enotempo…</h1>
    <p>Stai per essere reindirizzato automaticamente.</p>
    <p>Se non succede, clicca il pulsante qui sotto.</p>

    <form id="handoffForm" method="POST" action="${safeUrl}">
      <input type="hidden" name="token" value="${safeToken}">
      <button type="submit" class="button">Continua verso Enotempo</button>
    </form>

    <a href="/supporto" class="fallback-link">Hai bisogno di aiuto? Contatta il supporto</a>

    <div id="fallbackBox">
      <p>Se Enotempo non si apre, la tua affiliazione è comunque completata su FENAM.</p>
    </div>

    <noscript>
      <div style="margin-top: 1.2rem; padding: 1rem; background: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
        <p style="margin: 0; color: #856404;">
          <strong>JavaScript disabilitato:</strong> clicca "Continua verso Enotempo".
        </p>
      </div>
    </noscript>
  </div>

  <script>
    (function() {
      try {
        setTimeout(function() {
          var form = document.getElementById('handoffForm');
          if (form) form.submit();
        }, 500);

        setTimeout(function() {
          var box = document.getElementById('fallbackBox');
          if (box) box.classList.add('show');
        }, 9000);
      } catch (e) {}
    })();
  </script>
</body>
</html>`
}

export default async function handler(req, res) {
  // CORS
  if (handleCors(req, res)) return

  // Method
  if (!checkMethod(req, res, ['POST'])) return

  // Rate limit
  const allowed = await rateLimit(req, res)
  if (!allowed) return

  // PayPal configured
  if (!client) {
    logger.error('[PayPal Capture] PayPal client non configurato (missing client id/secret)')
    return sendError(res, 503, 'Service unavailable', 'PayPal non configurato. Contatta il supporto.')
  }

  // Validate input
  const parseResult = captureSchema.safeParse(req.body)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    logger.warn('[PayPal Capture] Validazione fallita', {
      orderID: req.body?.orderID ? 'presente' : 'mancante',
      category: 'VALIDATION',
    })
    return sendError(res, 400, firstError.message || 'Validation error', null, parseResult.error.errors)
  }

  const {
    orderID,
    nome: bodyNome,
    cognome: bodyCognome,
    email: bodyEmail,
    telefono: bodyTelefono,
    privacy: bodyPrivacy,
  } = parseResult.data

  const correlationId = getCorrelationId(req)
  const paypalBaseUrl = getPayPalBaseUrl()
  const paypalMode = isPayPalLive() ? 'live' : 'sandbox'
  const wantsJson = detectWantsJson(req)
  const logContext = { orderID, correlationId }

  logger.info('[PayPal Capture] route hit', {
    ...logContext,
    paypalBaseUrl,
    paypalMode,
    wantsJson,
  })

  // =========================
  // STEP 1: Capture (o GET se già catturato)
  // =========================
  let order
  try {
    logger.info('[PayPal Capture] Step 1: PayPal capture', { ...logContext, paypalBaseUrl, paypalMode })
    const captureRequest = new paypal.orders.OrdersCaptureRequest(orderID)
    const captureResponse = await client.execute(captureRequest)
    order = captureResponse.result
  } catch (captureErr) {
    if (isOrderAlreadyCaptured(captureErr)) {
      try {
        logger.info('[PayPal Capture] Capture già fatto, faccio GET order', logContext)
        const getRequest = new paypal.orders.OrdersGetRequest(orderID)
        const getResponse = await client.execute(getRequest)
        order = getResponse.result
      } catch (getErr) {
        logErrorStructured('[PayPal Capture] GET order fallito dopo already-captured', getErr, logContext, 'PAYPAL_API')
        return sendError(res, 502, 'PayPal error', 'Errore durante verifica ordine PayPal.', { orderID, correlationId })
      }
    } else {
      logErrorStructured(
        '[PayPal Capture] Errore PayPal SDK',
        captureErr,
        { ...logContext, statusCode: captureErr?.statusCode },
        'PAYPAL_API'
      )
      return sendError(res, 502, 'PayPal error', 'Errore durante il processamento del pagamento PayPal.', {
        orderID,
        correlationId,
      })
    }
  }

  const paypalStatus = order?.status || 'UNKNOWN'
  const debugId = order?.debug_id ?? order?.details?.[0]?.debug_id ?? null
  const reason = order?.details?.[0]?.issue || order?.message || null

  logger.info('[PayPal Capture] PayPal response', {
    ...logContext,
    paypalBaseUrl,
    paypalMode,
    paypalStatus,
    ...(debugId && { debug_id: debugId }),
    ...(reason && { reason }),
  })

  // Aggiorna DB debug status (se record esiste)
  try {
    const existingForDebug = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
      select: { id: true },
    })
    if (existingForDebug) {
      await prisma.affiliation.update({
        where: { id: existingForDebug.id },
        data: { lastPaypalStatus: paypalStatus, lastPaypalCheckedAt: new Date() },
      })
    }
  } catch (e) {
    // non bloccare per debug
    logger.warn('[PayPal Capture] Impossibile aggiornare lastPaypalStatus (non bloccante)', logContext)
  }

  // Se non COMPLETED: non completare affiliazione
  if (paypalStatus !== 'COMPLETED') {
    logger.warn('[PayPal Capture] Pagamento non COMPLETED', { ...logContext, paypalStatus })
    return sendSuccess(res, {
      ok: true,
      paypalStatus,
      correlationId,
      message: `Pagamento non completato: stato = ${paypalStatus}. Se hai appena pagato, riprova tra qualche minuto.`,
    })
  }

  // =========================
  // Estrai dati da PayPal order
  // =========================
  const payerEmail = order?.payer?.email_address || order?.payer?.email || null

  let captureId = null
  let amount = null
  let currency = null
  let orderAmount = null

  if (order?.purchase_units?.length > 0) {
    const pu = order.purchase_units[0]
    if (pu?.amount) orderAmount = pu.amount.value || null
    const cap = pu?.payments?.captures?.[0]
    if (cap) {
      captureId = cap.id || null
      if (cap.amount) {
        amount = cap.amount.value || null
        currency = cap.amount.currency_code || null
      }
    }
  }

  const amountNum = amount ? parseFloat(amount) : null
  if (amountNum !== null && amountNum < 10) {
    logger.warn('[PayPal Capture] Importo inferiore al minimo', { ...logContext, amount, orderAmount })
    return sendError(res, 400, 'Invalid amount', 'Importo minimo 10€')
  }

  // =========================
  // STEP 2: Recupera/crea affiliazione
  // =========================
  let existingAffiliation = await prisma.affiliation.findUnique({ where: { orderId: orderID } })

  if (!existingAffiliation) {
    // Recovery: ordine COMPLETED ma record non presente
    const recoveryNome = bodyNome && bodyNome.trim().length >= 2 ? bodyNome.trim().slice(0, 80) : 'N/D'
    const recoveryCognome = bodyCognome && bodyCognome.trim().length >= 2 ? bodyCognome.trim().slice(0, 80) : 'N/D'
    const recoveryEmail =
      (bodyEmail && isValidEmail(bodyEmail)) ? bodyEmail.trim().toLowerCase() : (payerEmail || 'N/D')
    const recoveryTelefono = bodyTelefono && bodyTelefono.trim().length ? bodyTelefono.trim().slice(0, 25) : 'N/D'
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
          lastPaypalStatus: 'COMPLETED',
          lastPaypalCheckedAt: new Date(),
        },
      })
      logger.warn('[PayPal Capture] Affiliation recovered (record creato da capture)', {
        ...logContext,
        affiliationId: existingAffiliation.id,
      })
    } catch (createErr) {
      // Doppia capture concorrente -> unique orderId
      if (createErr?.code === 'P2002') {
        const found = await prisma.affiliation.findUnique({ where: { orderId: orderID } })
        if (found) {
          existingAffiliation = found
        } else {
          logErrorStructured('[PayPal Capture] Recovery P2002 ma record non trovato', createErr, logContext, 'DB_CONN')
          return sendError(res, 500, 'Database error', 'Errore durante il recupero. Contatta il supporto.', {
            orderID,
            correlationId,
          })
        }
      } else {
        logErrorStructured('[PayPal Capture] Recovery create affiliation fallita', createErr, logContext, 'DB_CONN')
        return sendError(res, 500, 'Database error', 'OrderID non presente nel database. Contatta il supporto con l’ID ordine.', {
          orderID,
          correlationId,
        })
      }
    }
  }

  // =========================
  // Idempotenza: già completed
  // =========================
  if (existingAffiliation.status === 'completed') {
    logger.info('[PayPal Capture] Affiliazione già completata (idempotente)', {
      ...logContext,
      affiliationId: existingAffiliation.id,
      memberNumber: existingAffiliation.memberNumber,
      emailSent: !!existingAffiliation.confirmationEmailSentAt,
      cardSent: !!existingAffiliation.membershipCardSentAt,
    })

    return sendSuccess(res, {
      ok: true,
      already_completed: true,
      status: 'completed',
      orderID,
      memberNumber: existingAffiliation.memberNumber,
      emailSent: !!existingAffiliation.confirmationEmailSentAt,
      cardSent: !!existingAffiliation.membershipCardSentAt,
      correlationId,
    })
  }

  // =========================
  // STEP 3: DB update (CRITICO)
  // =========================
  let dbResult
  const dbStatusBefore = existingAffiliation.status

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
      memberNumber: dbResult?.memberNumber,
    })
  } catch (dbError) {
    logErrorStructured(
      '[PayPal Capture] ERRORE CRITICO: DB update fallito dopo PayPal COMPLETED',
      dbError,
      { ...logContext, affiliationId: existingAffiliation.id, dbStatusBefore },
      'DB_CONN'
    )

    try {
      await prisma.affiliation.update({
        where: { id: existingAffiliation.id },
        data: { lastPaypalStatus: 'COMPLETED', lastPaypalCheckedAt: new Date() },
      })
    } catch (_) {}

    return sendError(
      res,
      500,
      'Database error',
      'Pagamento completato ma errore durante aggiornamento database. Contatta il supporto con l’ID ordine.',
      { orderID, correlationId }
    )
  }

  // =========================
  // STEP 4: Side effects NON bloccanti (email + PDF)
  // =========================
  let sideEffectsResult = { emailSent: false, cardSent: false, warnings: [] }

  try {
    logger.info('[PayPal Capture] Step 4: side effects (email/PDF)', {
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
  } catch (sideEffectsError) {
    logErrorStructured(
      '[PayPal Capture] Side effects error (non bloccante)',
      sideEffectsError,
      { ...logContext, affiliationId: existingAffiliation.id },
      'EMAIL'
    )
    sideEffectsResult.warnings = sideEffectsResult.warnings || []
    sideEffectsResult.warnings.push('Errore durante invio email/tessera')
  }

  // ricarica record aggiornato (per risposta/handoff)
  const updatedAffiliation = await prisma.affiliation.findUnique({ where: { orderId: orderID } })

  // =========================
  // STEP 5: Risposta + Handoff (Enotempo)
  // =========================
  const handoffUrl = process.env.ENOTEMPO_HANDOFF_URL

  // Costruiamo sempre la response JSON standard (anche se poi facciamo HTML)
  const baseResponse = {
    ok: true,
    status: 'COMPLETED',
    orderID,
    captureId,
    amount,
    currency,
    memberNumber: dbResult?.memberNumber || updatedAffiliation?.memberNumber || null,
    emailSent: !!sideEffectsResult.emailSent,
    cardSent: !!sideEffectsResult.cardSent,
    correlationId,
  }
  if (sideEffectsResult.warnings?.length > 0) baseResponse.warnings = sideEffectsResult.warnings

  if (handoffUrl && updatedAffiliation) {
    try {
      const now = Math.floor(Date.now() / 1000)
      const exp = now + 600

      const tokenPayload = {
        iss: 'fenam',
        affiliationId: updatedAffiliation.id,
        email: updatedAffiliation.email,
        donation: amountNum || 0,
        orderId: orderID,
        exp,
        nonce: crypto.randomBytes(16).toString('hex'),
      }

      const token = createHandoffToken(tokenPayload)

      // ✅ Per fetch/XHR: JSON con dati handoff (NO HTML)
      if (wantsJson) {
        return sendSuccess(res, {
          ...baseResponse,
          handoff: { url: handoffUrl, token },
        })
      }

      // ✅ Per navigazione: HTML autosubmit
      const html = renderHandoffHtml(handoffUrl, token)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.status(200).send(html)
    } catch (tokenError) {
      logger.error('[PayPal Capture] Errore generazione token handoff', {
        ...logContext,
        error: tokenError?.message,
      })
      // fallback: JSON normale sotto
    }
  }

  // Default: JSON
  return sendSuccess(res, baseResponse)
}
