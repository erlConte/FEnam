// pages/api/newsletter.js
import { z } from 'zod'
import { Resend } from 'resend'
import { rateLimit } from '../../lib/rateLimit'
import { checkMethod, sendError, sendSuccess } from '../../lib/apiHelpers'
import { handleCors } from '../../lib/cors'
import { logger } from '../../lib/logger'

// Inizializza Resend opzionalmente (non blocca startup se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

// Schema di validazione per email + consenso
const subscribeSchema = z.object({
  email:   z.string().email('Email non valida'),
  consent: z.boolean().refine(v => v, { message: 'Consenso obbligatorio' }),
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

  // Verifica Resend configurato
  if (!resend) {
    logger.error('[Newsletter] RESEND_API_KEY o SENDER_EMAIL non configurati')
    return sendError(res, 503, 'Service unavailable', 'Servizio newsletter momentaneamente non disponibile. Riprova più tardi.')
  }

  // Verifica RESEND_AUDIENCE_ID configurato (richiesto per aggiungere contatti)
  if (!process.env.RESEND_AUDIENCE_ID) {
    logger.error('[Newsletter] RESEND_AUDIENCE_ID non configurato')
    return sendError(res, 503, 'Service unavailable', 'Servizio newsletter momentaneamente non disponibile. Riprova più tardi.')
  }

  // Validazione input
  const parseResult = subscribeSchema.safeParse(req.body)
  if (!parseResult.success) {
    const msg = parseResult.error.issues[0].message
    return sendError(res, 400, 'Validation error', msg)
  }
  const { email } = parseResult.data

  try {
    // Aggiungi direttamente all'audience Resend (senza DB, senza doppio opt-in)
    await resend.contacts.create({
      audienceId: process.env.RESEND_AUDIENCE_ID,
      email: email,
    })

    logger.info(`[Newsletter] Email ${email} aggiunta all'audience Resend`)

    return sendSuccess(res, { ok: true })
  } catch (err) {
    // Gestione errori Resend
    if (err.response?.status === 422) {
      // Email già presente nell'audience (non è un errore critico)
      logger.info(`[Newsletter] Email ${email} già presente nell'audience`)
      return sendSuccess(res, { ok: true })
    }

    logger.error('[Newsletter] Errore aggiunta contatto Resend', err)
    return sendError(res, 500, 'Internal server error', 'Errore durante l\'iscrizione. Riprova più tardi.')
  }
}
