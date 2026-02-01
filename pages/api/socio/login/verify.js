// GET /api/socio/login/verify — Verifica magic link, marca usato, genera handoff e redirect
// Query: token, returnUrl?, source?
// Redirect: in base a source (enotempo → returnUrl valida con token; fenam/altro → /accedi-socio?success=1).
// Token monouso: hash in DB, usedAt in transazione. Nessun PII nei log.

import crypto from 'crypto'
import { prisma } from '../../../../lib/prisma'
import { createHandoffToken } from '../../../../lib/handoffToken'
import { getSafeReturnUrl } from '../../../../lib/validateReturnUrl'
import {
  COOKIE_NAME,
  createMemberSessionToken,
  getCookieOptions,
  formatSetCookie,
  getRequestHost,
} from '../../../../lib/memberSession'
import { logger } from '../../../../lib/logger'

const TOKEN_EXPIRY_SECONDS = 600 // 10 min per handoff
const MEMBER_SESSION_DAYS = 30
const MEMBER_SESSION_MAX_AGE = MEMBER_SESSION_DAYS * 24 * 60 * 60

function sha256hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).send('Method Not Allowed')
  }

  const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
  let returnUrl = typeof req.query.returnUrl === 'string' ? req.query.returnUrl : null
  const source = typeof req.query.source === 'string' ? req.query.source : null

  if (returnUrl) {
    try {
      returnUrl = decodeURIComponent(returnUrl)
    } catch {
      returnUrl = req.query.returnUrl
    }
  }

  const src = (source || 'fenam').toLowerCase().trim()

  if (!token) {
    return res.redirect(302, '/accedi-socio?error=missing_token')
  }

  const tokenHash = sha256hex(token)

  const record = await prisma.$transaction(async (tx) => {
    const row = await tx.memberLoginToken.findUnique({
      where: { tokenHash },
      include: { affiliation: true },
    })
    if (!row || row.usedAt || new Date(row.expiresAt) <= new Date()) {
      return null
    }
    await tx.memberLoginToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })
    return row
  })

  if (!record) {
    logger.warn('[Socio Login Verify] Token non valido, scaduto o già usato')
    return res.redirect(302, '/accedi-socio?error=invalid_or_used')
  }

  const affiliation = record.affiliation
  const memberUntilDate = affiliation.memberUntil ? new Date(affiliation.memberUntil) : null
  const nowDate = new Date()
  if (affiliation.status !== 'completed' || !memberUntilDate || memberUntilDate <= nowDate) {
    logger.warn('[Socio Login Verify] Affiliazione non più attiva dopo uso token')
    return res.redirect(302, '/accedi-socio?error=membership_expired')
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = now + TOKEN_EXPIRY_SECONDS
  const payload = {
    sub: affiliation.memberNumber || affiliation.id,
    src: src === 'enotempo' ? 'enotempo' : 'fenam',
    iat: now,
    exp,
  }
  const handoffToken = createHandoffToken(payload)

  // Set-Cookie PRIMA di qualsiasi redirect; host da x-forwarded-host per proxy/Vercel
  const host = getRequestHost(req)
  try {
    const sessionExp = now + MEMBER_SESSION_MAX_AGE
    const memberSessionToken = createMemberSessionToken({
      affiliationId: affiliation.id,
      exp: sessionExp,
    })
    const cookieOpts = getCookieOptions({ maxAgeSeconds: MEMBER_SESSION_MAX_AGE, host })
    res.setHeader('Set-Cookie', formatSetCookie(COOKIE_NAME, memberSessionToken, cookieOpts))
  } catch (sessionErr) {
    logger.warn('[Socio Login Verify] Member session non impostata', sessionErr?.message || sessionErr)
  }

  if (src === 'enotempo') {
    const safeReturnUrl = getSafeReturnUrl(returnUrl)
    if (!safeReturnUrl) {
      return res.redirect(302, '/accedi-socio?error=invalid_return')
    }
    const redirectUrl = new URL(safeReturnUrl)
    redirectUrl.searchParams.set('status', 'success')
    redirectUrl.searchParams.set('token', handoffToken)
    return res.redirect(302, redirectUrl.toString())
  }

  // source !== enotempo (fenam o altro): redirect interno FENAM (cookie già impostato)
  return res.redirect(302, '/accedi-socio?success=1')
}
