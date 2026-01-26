import paypal from '@paypal/checkout-server-sdk'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { randomBytes } from 'crypto'
import { rateLimit } from '../../../lib/rateLimit'
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
      return isNaN(num) ? 10 : Math.max(10, num)
    })
    .pipe(z.number().min(10, 'La donazione minima è €10').max(10000, 'Donazione massima €10.000')),
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

  // Verifica che donazione sia >= 10
  if (!donazione || donazione < 10) {
    return sendError(res, 400, 'Invalid donation', 'La donazione minima è €10', [
      { path: ['donazione'], message: 'La donazione minima è €10' }
    ])
  }

  // Calcolo importo (solo donazione, quota base rimossa)
  const total = Math.round(donazione * 100) / 100 // rounding a 2 decimali

  // Validazione total
  if (total < 10) {
    return sendError(res, 400, 'Invalid amount', 'La donazione minima è €10', [
      { path: ['donazione'], message: 'La donazione minima è €10' }
    ])
  }
  if (total > 10000) {
    return sendError(res, 400, 'Amount too high', 'La donazione non può superare €10.000', [
      { path: ['donazione'], message: 'La donazione non può superare €10.000' }
    ])
  }

  const totalFormatted = total.toFixed(2) // string "xx.xx"

  // 3) Genera identificatore interno per reference_id
  const internalRef = randomBytes(8).toString('hex')

  try {
    // 4) Crea ordine PayPal
    const request = new paypal.orders.OrdersCreateRequest()
    request.requestBody({
      intent: 'CAPTURE',
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

    // 5) Persistenza su DB con idempotenza
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

    return sendSuccess(res, { orderID: orderId })
  } catch (paypalError) {
    // Errore PayPal: log dettagliato (senza esporre secret)
    logger.error('[PayPal API] PayPal error', paypalError, {
      statusCode: paypalError.statusCode,
    })
    return sendError(res, 502, 'PayPal error', 'Errore durante la creazione dell\'ordine PayPal')
  }
}
