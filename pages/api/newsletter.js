// pages/api/newsletter.js
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { Resend } from 'resend'
import crypto from 'crypto'
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
    return sendError(res, 503, 'Service unavailable', 'Servizio email non disponibile. Contatta il supporto.')
  }

  // Validazione input
  const parseResult = subscribeSchema.safeParse(req.body)
  if (!parseResult.success) {
    const msg = parseResult.error.issues[0].message
    return sendError(res, 400, 'Validation error', msg)
  }
  const { email } = parseResult.data

  // Generazione token e scadenza (24h)
  const token     = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  try {
    // Salvo richiesta in database
    await prisma.newsletterSubscription.create({
      data: { email, token, expiresAt },
    })

    // Costruisco link di conferma
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!baseUrl) {
      logger.error('[Newsletter] NEXT_PUBLIC_BASE_URL is missing')
      return sendError(res, 500, 'Configuration error', 'Configurazione server errata')
    }
    const confirmUrl  = `${baseUrl}/newsletter/confirm?token=${token}`

    // Invio email di conferma
    await resend.emails.send({
      from:    process.env.SENDER_EMAIL,
      to:      email,
      subject: 'Conferma la tua iscrizione alla newsletter F.E.N.A.M.',
      html: `
        <p>Ciao!</p>
        <p>Grazie per esserti iscritto alla nostra newsletter.</p>
        <p>Per completare l'iscrizione, clicca qui 👉 <a href="${confirmUrl}">Conferma la tua email</a></p>
        <p>Il link scade in 24 ore.</p>
      `,
    })

    return sendSuccess(res, { ok: true })
  } catch (err) {
    logger.error('[Newsletter] Errore', err)
    return sendError(res, 500, 'Internal server error', 'Errore interno al server')
  }
}
