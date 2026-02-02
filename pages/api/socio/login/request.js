// POST /api/socio/login/request — Richiesta magic link per socio già affiliato (no Supabase Auth)
// Body: { email, returnUrl?, source? }. source/returnUrl salvati in DB; link email contiene SOLO token.
// Rate limit: 5/ora per IP. Max 5 token/ora per email. Nessun PII nei log.

import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { rateLimit } from '../../../../lib/rateLimit'
import { checkMethod, sendError, sendSuccess } from '../../../../lib/apiHelpers'
import { validateReturnUrl } from '../../../../lib/returnUrl'
import { logger } from '../../../../lib/logger'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@fenam.website'
// Canonico senza www: link email usa solo BASE_URL da env, mai req.headers.host
const BASE_URL = process.env.BASE_URL || 'https://fenam.website'

const requestSchema = z.object({
  email: z
    .string()
    .min(1, 'Email obbligatoria')
    .email('Email non valida')
    .transform((v) => v.trim().toLowerCase()),
  returnUrl: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
})

const TOKEN_EXPIRY_MINUTES = 15
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5

function sha256hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim())
    return ips[0]
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

export default async function handler(req, res) {
  if (!checkMethod(req, res, ['POST'])) return

  // Rate limit: 5 richieste/ora per IP
  const allowed = await rateLimit(req, res, {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  })
  if (!allowed) return

  const parseResult = requestSchema.safeParse(req.body)
  if (!parseResult.success) {
    const first = parseResult.error.errors[0]
    return sendError(res, 400, first.message || 'Validazione fallita', null, parseResult.error.errors)
  }

  // Leggi body.source esplicitamente (Zod + fallback da req.body per robustezza)
  const bodySourceRaw = parseResult.data.source ?? (req.body && typeof req.body.source !== 'undefined' ? req.body.source : null)
  const bodySource = bodySourceRaw != null ? String(bodySourceRaw).trim().toLowerCase() : ''
  const src = bodySource === 'enotempo' ? 'enotempo' : 'fenam'

  const { email, returnUrl: rawReturnUrl } = parseResult.data

  const allowedHosts = process.env.FENAM_ALLOWED_RETURN_HOSTS || 'enotempo.it,www.enotempo.it'
  let validatedReturnUrl = null
  if (rawReturnUrl != null && String(rawReturnUrl).trim() !== '') {
    const result = validateReturnUrl(String(rawReturnUrl).trim(), allowedHosts)
    if (result.ok) validatedReturnUrl = result.returnUrl
    if (src === 'enotempo' && !validatedReturnUrl) {
      return sendError(res, 400, 'URL di ritorno non valido', 'Per tornare su Enotempo è necessario un URL di ritorno valido (HTTPS e dominio consentito). Verifica il link o contatta il supporto.')
    }
  } else if (src === 'enotempo') {
    return sendError(res, 400, 'URL di ritorno mancante', 'Per tornare su Enotempo è necessario fornire l’URL di ritorno.')
  }

  const now = new Date()

  // Cerca socio attivo: status completed, memberUntil > now
  const affiliation = await prisma.affiliation.findFirst({
    where: {
      email,
      status: 'completed',
      memberUntil: { gt: now },
    },
    orderBy: { memberUntil: 'desc' },
    select: { id: true },
  })

  if (!affiliation) {
    return res.status(403).json({
      error: 'Non risulti socio attivo',
      message: 'Nessuna tessera attiva trovata per questa email. Verifica l’indirizzo o rinnova l’affiliazione.',
    })
  }

  // Rate limit per email: max 5 token creati nell’ultima ora per questa affiliation
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const recentCount = await prisma.memberLoginToken.count({
    where: {
      affiliationId: affiliation.id,
      createdAt: { gte: oneHourAgo },
    },
  })
  if (recentCount >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
    return res.status(429).json({
      error: 'Troppe richieste',
      message: 'Hai già richiesto un link di accesso di recente. Controlla la posta o riprova tra un’ora.',
      retryAfter: 3600,
    })
  }

  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256hex(rawToken)
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MINUTES * 60 * 1000)

  const requestIp = getClientIP(req)
  const userAgent = (req.headers['user-agent'] || '').slice(0, 500)

  await prisma.memberLoginToken.create({
    data: {
      tokenHash,
      affiliationId: affiliation.id,
      expiresAt,
      source: src,
      returnUrl: src === 'enotempo' ? validatedReturnUrl : null,
      requestIp,
      userAgent,
    },
  })

  const verifyPath = '/api/socio/login/verify'
  const verifyUrl = new URL(verifyPath, BASE_URL)
  verifyUrl.searchParams.set('token', rawToken)

  if (process.env.NODE_ENV !== 'test') {
    logger.info('[Socio Login Request]', { src, hasReturnUrl: src === 'enotempo' ? !!validatedReturnUrl : false, tokenCreated: true })
  }

  if (RESEND_API_KEY && SENDER_EMAIL) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(RESEND_API_KEY)
      await resend.emails.send({
        from: SENDER_EMAIL,
        to: email,
        subject: 'Link di accesso socio FENAM',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Clicca il link qui sotto per accedere (valido ${TOKEN_EXPIRY_MINUTES} minuti):</p>
  <p><a href="${verifyUrl.toString()}" style="color: #024230;">${verifyUrl.toString()}</a></p>
  <p>Se non hai richiesto tu questo link, ignora questa email.</p>
  <p>— Il team FENAM</p>
</body>
</html>`,
        text: `Clicca per accedere (valido ${TOKEN_EXPIRY_MINUTES} minuti):\n${verifyUrl.toString()}\n\nSe non hai richiesto tu questo link, ignora questa email.\n— Il team FENAM`,
      })
    } catch (err) {
      logger.error('[Socio Login Request] Invio email fallito', { errMsg: err?.message || 'unknown' })
      return sendError(res, 503, 'Service unavailable', 'Impossibile inviare l’email. Riprova più tardi.')
    }
  } else {
    logger.warn('[Socio Login Request] Resend non configurato, link non inviato')
    return sendError(res, 503, 'Service unavailable', 'Servizio email non configurato.')
  }

  return sendSuccess(res, {
    ok: true,
    message: 'Se l’email è associata a un socio attivo, riceverai a breve un link di accesso.',
  })
}
