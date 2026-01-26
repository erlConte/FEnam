import paypal from '@paypal/checkout-server-sdk'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'
import { completeAffiliation } from '../../../lib/affiliation'
import { checkMethod, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger } from '../../../lib/logger'

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
      logger.error(`[PayPal Capture] OrderId ${orderID} non trovato nel DB`)
      return sendError(res, 404, 'Affiliation not found', 'OrderID non presente nel database. Contatta il supporto.')
    }

    // Se già completed, ritorna successo (idempotente)
    if (existingAffiliation.status === 'completed') {
      return sendSuccess(res, {
        ok: true,
        status: 'completed',
        orderID,
        message: 'Affiliazione già completata',
      })
    }

    // Usa funzione condivisa per completare affiliazione
    const completionResult = await completeAffiliation({
      affiliationId: existingAffiliation.id,
      payerEmail,
      amount: amount ? parseFloat(amount) : null,
      currency: currency || 'EUR',
    })

    // Recupera affiliazione aggiornata per risposta
    const updatedAffiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
    })

    // Log informazioni capture (senza dati sensibili)
    logger.info(`[PayPal Capture] Order ${orderID} completato`, {
      status,
      captureId: captureId ? 'presente' : 'non disponibile',
      amount: amount ? 'presente' : 'non disponibile',
      currency: currency || 'non disponibile',
      memberNumber: updatedAffiliation.memberNumber || 'non generato',
      emailSent: completionResult.emailSent,
      cardSent: completionResult.cardSent,
    })

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
    // Errore PayPal: log dettagliato (senza esporre secret)
    logger.error('[PayPal Capture] PayPal error', paypalError, {
      statusCode: paypalError.statusCode,
      orderID,
    })

    // Se l'errore è specifico (es. order già catturato), possiamo gestirlo meglio
    if (paypalError.statusCode === 422) {
      // 422 = Unprocessable Entity (es. order già catturato o non valido)
      return sendError(res, 502, 'PayPal error', 'Ordine non valido o già processato')
    }

    return sendError(res, 502, 'PayPal error', 'Errore durante il processamento del pagamento')
  }
}
