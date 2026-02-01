// lib/memberSession.js
// Sessione socio leggera: token firmato HMAC (affiliationId + exp), usato in cookie httpOnly.
// NO Supabase Auth, NO account utente. Secret: FENAM_MEMBER_SESSION_SECRET (o FENAM_HANDOFF_SECRET), min 16 caratteri.

import crypto from 'crypto'

export const COOKIE_NAME = 'fenamMemberSession'
const DEFAULT_MAX_AGE_DAYS = 30

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64')
}

function getSecret() {
  const secret = process.env.FENAM_MEMBER_SESSION_SECRET || process.env.FENAM_HANDOFF_SECRET
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    return null
  }
  return secret.trim()
}

/**
 * Crea token sessione socio: base64url(payload).base64url(hmac)
 * @param {{ affiliationId: string, exp: number }} payload
 * @returns {string} Token firmato
 */
export function createMemberSessionToken({ affiliationId, exp }) {
  const secret = getSecret()
  if (!secret) {
    throw new Error('FENAM_MEMBER_SESSION_SECRET o FENAM_HANDOFF_SECRET mancante o troppo corto (min 16 caratteri)')
  }
  const payload = { affiliationId, exp }
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payloadB64)
  const signature = base64UrlEncode(hmac.digest())
  return `${payloadB64}.${signature}`
}

/**
 * Verifica token: HMAC e exp > now. Ritorna payload o null.
 * @param {string} token
 * @returns {{ affiliationId: string, exp: number } | null}
 */
export function verifyMemberSessionToken(token) {
  const secret = getSecret()
  if (!secret || !token || typeof token !== 'string') {
    return null
  }
  try {
    const [payloadB64, signature] = token.trim().split('.')
    if (!payloadB64 || !signature) return null

    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payloadB64)
    const expectedSignature = base64UrlEncode(hmac.digest())
    const signatureBuffer = base64UrlDecode(signature)
    const expectedBuffer = base64UrlDecode(expectedSignature)
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'))
    const now = Math.floor(Date.now() / 1000)
    if (!payload.exp || payload.exp < now) return null
    if (!payload.affiliationId) return null
    return { affiliationId: payload.affiliationId, exp: payload.exp }
  } catch {
    return null
  }
}

const FENAM_DOMAIN_SUFFIX = 'fenam.website'
const FENAM_COOKIE_DOMAIN = '.fenam.website'

/**
 * Estrae host dalla request (x-forwarded-host ha priorità, es. Vercel/proxy).
 * @param {import('http').IncomingMessage} req
 * @returns {string | undefined}
 */
export function getRequestHost(req) {
  if (!req || !req.headers) return undefined
  const forwarded = req.headers['x-forwarded-host']
  const host = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : req.headers.host
  return host || undefined
}

/**
 * Se host è fenam.website, www.fenam.website o *.fenam.website => Domain=.fenam.website.
 * Altrimenti undefined (es. preview Vercel) per non rompere ambienti non produzione.
 * @param {string} [host] - da getRequestHost(req) o req.headers['x-forwarded-host'] || req.headers.host
 * @returns {string | undefined}
 */
export function getCookieDomain(host) {
  if (!host || typeof host !== 'string') return undefined
  const h = host.trim().toLowerCase().replace(/\.$/, '')
  return h.endsWith(FENAM_DOMAIN_SUFFIX) ? FENAM_COOKIE_DOMAIN : undefined
}

/**
 * Opzioni cookie per Set-Cookie (verify) e per clear (logout).
 * @param {{ maxAgeSeconds?: number, clear?: boolean, host?: string }} opts - host da getRequestHost(req) per Domain dinamico
 */
export function getCookieOptions({ maxAgeSeconds = DEFAULT_MAX_AGE_DAYS * 24 * 60 * 60, clear = false, host } = {}) {
  const isProd = process.env.NODE_ENV === 'production'
  const base = {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
  }
  const domain = getCookieDomain(host)
  if (domain) base.domain = domain
  if (clear) {
    return { ...base, maxAge: 0 }
  }
  return { ...base, maxAge: maxAgeSeconds }
}

export function formatSetCookie(name, value, options) {
  const parts = [`${name}=${value}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  return parts.join('; ')
}

