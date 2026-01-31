import paypal from '@paypal/checkout-server-sdk'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { randomBytes } from 'crypto'
import { rateLimit } from '../../../lib/rateLimit'
import { checkMethod, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger, getCorrelationId } from '../../../lib/logger'
import { createPayPalClient, getPayPalBaseUrl, isPayPalLive } from '../../../lib/paypalEnv'

// Inizializza PayPal client opzionalmente (non blocca startup se manca)
const { client } = createPayPalClient()

// Flusso esplicito: 1) valida input 2) crea ordine PayPal (intent CAPTURE) 3) crea record Affiliation pending 4) ritorna orderID
// TODO P0: Verificare che NEXT_PUBLIC_PAYPAL_CLIENT_ID === PAYPAL_CLIENT_ID (stesso ambiente sandbox/live).
// TODO P1: PAYPAL_ENV sbagliato (es. production in preview) forza modalità errata; controllare in Vercel.
// TODO P1: Se il conto PayPal non accetta currency/amount (es. EUR o importo), l'ordine fallirà; messaggio da PayPal in log.
// TODO P1: "Donazione" è concettuale: l'ordine è un pagamento normale PayPal; ricevuta/descrizione da allineare a branding.

// Schema di validazione Zod
const affiliationSchema = z.object({
  nome: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, { message: 'Nome troppo corto (min 2 caratteri)' })
    .refine((val) => val.length <= 80, { message: 'Nome troppo lungo (max 80 caratteri)' }),
  cognome: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, { message: 'Cognome troppo corto (min 2 caratteri)' })
    .refine((val) => val.length <= 80, { message: 'Cognome troppo lungo (max 80 caratteri)' }),
  email: z
    .string()
    .email('Email non valida')
    .transform((val) => val.trim().toLowerCase()),
  telefono: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 6, { message: 'Telefono troppo corto (min 6 caratteri)' })
    .refine((val) => val.length <= 25, { message: 'Telefono troppo lungo (max 25 caratteri)' }),
  privacy: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Consenso privacy obbligatorio',
    }),
  donazione: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return 10
      const num = typeof val === 'string' ? parseFloat(val) : val
      return isNaN(num) ? 10 : num
    })
    .pipe(z.number().min(0, 'La donazione non può essere negativa').max(10000, 'Donazione massima €10.000')),
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
    logger.error('[PayPal API] PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET non configurati')
    return sendError(res, 503, 'Service unavailable', 'PayPal non configurato. Contatta il supporto.')
  }

  // Validazione input con Zod
  const parseResult = affiliationSchema.safeParse(req.body)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return sendError(res, 400, firstError.message || 'Validation error', null, parseResult.error.errors)
  }

  const { nome, cognome, email, telefono, privacy, donazione } = parseResult.data

  // Donazione 0: non passare da PayPal, usare /api/affiliazione/free
  if (donazione === 0) {
    return sendError(res, 400, 'Invalid donation', 'Donazione 0: usa /api/affiliazione/free', [
      { path: ['donazione'], message: 'Donazione 0: usa /api/affiliazione/free' }
    ])
  }

  // Calcolo importo (solo donazione)
  const total = Math.round(donazione * 100) / 100

  if (total <= 0) {
    return sendError(res, 400, 'Invalid amount', 'Donazione 0: usa /api/affiliazione/free', [
      { path: ['donazione'], message: 'Donazione 0: usa /api/affiliazione/free' }
    ])
  }
  if (total < 10) {
    return sendError(res, 400, 'Invalid amount', 'Importo minimo 10€', [
      { path: ['donazione'], message: 'Importo minimo 10€' }
    ])
  }
  if (total > 10000) {
    return sendError(res, 400, 'Amount too high', 'La donazione non può superare €10.000', [
      { path: ['donazione'], message: 'La donazione non può superare €10.000' }
    ])
  }

  const totalFormatted = total.toFixed(2) // string "xx.xx"
  const currency = 'EUR'
  const intent = 'CAPTURE'

  const correlationId = getCorrelationId(req)
  const paypalBaseUrl = getPayPalBaseUrl()
  const paypalMode = isPayPalLive() ? 'live' : 'sandbox'

  logger.info('[PayPal API] Create order start', {
    correlationId,
    paypalBaseUrl,
    paypalMode,
    intent,
    amount: totalFormatted,
    currency,
  })

  // Impedire affiliazioni duplicate attive: stessa email, completed, memberUntil > now
  const existing = await prisma.affiliation.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'completed',
      memberUntil: { gt: new Date() },
    },
  })
  if (existing) {
    return sendError(
      res,
      409,
      'Already affiliated',
      'Risulti già affiliato. La tua tessera è ancora valida.'
    )
  }

  // 2) Crea ordine PayPal (intent CAPTURE)
  const internalRef = randomBytes(8).toString('hex')
  try {
    const request = new paypal.orders.OrdersCreateRequest()
    request.requestBody({
      intent,
      purchase_units: [
        {
          reference_id: internalRef,
          custom_id: internalRef,
          amount: {
            currency_code: 'EUR',
            value: totalFormatted,
          },
          description: `Affiliazione + Donazione €${totalFormatted}`,
        },
      ],
    })

    const order = await client.execute(request)
    const orderId = order.result.id

    logger.info('[PayPal API] Ordine creato', {
      correlationId,
      paypalBaseUrl,
      paypalMode,
      intent,
      amount: totalFormatted,
      currency,
      orderID: orderId,
    })

    // 3) Crea record Affiliation pending (orderId + metadata utili; importo/currency non in schema, solo in PayPal)
    // Idempotenza: se orderId già presente (duplicato) restituiamo comunque orderID
    try {
      await prisma.affiliation.create({
        data: {
          nome,
          cognome,
          email,
          telefono,
          privacy,
          orderId,
          status: 'pending',
        },
      })
    } catch (dbError) {
      // Gestione idempotenza: se orderId già esiste (P2002 = unique constraint violation)
      if (dbError.code === 'P2002' && dbError.meta?.target?.includes('orderId')) {
        logger.warn(`[PayPal API] OrderId ${orderId} già presente nel DB, probabilmente richiesta duplicata`)
        // Continua comunque, restituiamo l'orderID
      } else {
        // Altro errore DB: loggiamo ma non blocchiamo (order già creato su PayPal)
        logger.error('[PayPal API] Errore DB dopo creazione order', dbError, { orderId })
      }
    }

    // 4) Ritorna orderID
    return sendSuccess(res, { orderID: orderId })
  } catch (paypalError) {
    logger.error('[PayPal API] PayPal error', paypalError, {
      correlationId,
      paypalBaseUrl,
      paypalMode,
      category: 'PAYPAL_API',
      statusCode: paypalError.statusCode,
    })
    return sendError(res, 502, 'PayPal error', 'Errore durante la creazione dell\'ordine PayPal')
  }
}
