// GET /api/socio/login/verify — Verifica magic link, marca usato, genera handoff e redirect
// Query: token, returnUrl?, source?
// Token monouso: hash in DB, usedAt marcato in transazione. Nessun PII nei log.

import crypto from 'crypto'
import { prisma } from '../../../../lib/prisma'
import { createHandoffToken } from '../../../../lib/handoffToken'
import { getSafeReturnUrl } from '../../../../lib/validateReturnUrl'
import { logger } from '../../../../lib/logger'

const TOKEN_EXPIRY_SECONDS = 600 // 10 min per handoff

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

  const safeReturnUrl = getSafeReturnUrl(returnUrl)
  if (!safeReturnUrl) {
    return res.redirect(302, '/accedi-socio?error=invalid_return')
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = now + TOKEN_EXPIRY_SECONDS
  const payload = {
    sub: affiliation.memberNumber || affiliation.id,
    src: source || 'enotempo',
    iat: now,
    exp,
  }
  const handoffToken = createHandoffToken(payload)

  const redirectUrl = new URL(safeReturnUrl)
  redirectUrl.searchParams.set('status', 'success')
  redirectUrl.searchParams.set('token', handoffToken)

  return res.redirect(302, redirectUrl.toString())
}
