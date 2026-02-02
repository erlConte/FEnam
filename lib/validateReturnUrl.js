// lib/validateReturnUrl.js
// Valida URL di return per handoff FENAM -> Enotempo.
// Solo HTTPS, host in FENAM_ALLOWED_RETURN_HOSTS. Ritorna URL normalizzato (stringa) o null.
// Nessun PII nei log. Debug opzionale: RETURNURL_DEBUG=1 logga solo hostname e allowed (no URL completa).

import { safeDecodeOnce } from './safeDecode'

/**
 * Normalizza stringa per confronto: trim, lowercase, rimuovi trailing dot.
 * @param {string} s
 * @returns {string}
 */
function normalizeHostPart(s) {
  if (typeof s !== 'string') return ''
  return s.trim().toLowerCase().replace(/\.+$/, '')
}

/**
 * Lista host consentiti da env: split, trim, lowercase, rimuovi trailing dot, filter(Boolean).
 * @returns {string[]}
 */
function getAllowedHosts() {
  const raw = process.env.FENAM_ALLOWED_RETURN_HOSTS
  if (!raw || typeof raw !== 'string') {
    return ['enotempo.it', 'www.enotempo.it']
  }
  return raw
    .split(',')
    .map((h) => normalizeHostPart(h))
    .filter(Boolean)
}

/**
 * Valida e normalizza URL di return.
 * - Input: null/undefined/empty -> null; trim; decodeURIComponent una volta (try/catch).
 * - Protocol: solo https:
 * - Hostname: url.hostname (NON url.host), lowercase, rimuovi trailing dot.
 * - Match: allowed.includes(hostname) con liste normalizzate.
 * - Return: url.toString() normalizzato.
 *
 * @param {string|null|undefined} returnParam - URL da validare (può essere encoded)
 * @returns {string|null} URL validato e normalizzato, o null se non valido
 */
export function getSafeReturnUrl(returnParam) {
  if (returnParam == null || typeof returnParam !== 'string') {
    return null
  }
  const trimmed = returnParam.trim()
  if (trimmed === '') {
    return null
  }

  const toParse = safeDecodeOnce(trimmed)

  let url
  try {
    url = new URL(toParse)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') {
    return null
  }

  const hostname = normalizeHostPart(url.hostname)
  if (!hostname) {
    return null
  }

  const allowed = getAllowedHosts()
  if (process.env.RETURNURL_DEBUG === '1') {
    console.info('[ValidateReturnUrl]', {
      hostname,
      allowedCount: allowed.length,
      allowedSample: allowed.slice(0, 5),
    })
  }
  if (!allowed.includes(hostname)) {
    return null
  }

  return url.toString().replace(/\/$/, '') || url.toString()
}
