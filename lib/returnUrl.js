// lib/returnUrl.js — helper query + validazione returnUrl (server-side). Nessun PII in log.

/**
 * Estrae primo valore stringa da query param (Next.js può restituire string | string[]).
 * Non decodifica: passare raw all'API; validazione lato server.
 * @param {string | string[] | undefined} v
 * @returns {string | undefined}
 */
export function firstQueryValue(v) {
  if (v == null) return undefined
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined
  return typeof v === 'string' ? v : undefined
}

/**
 * Decode URI component una volta; se fallisce ritorna l'input.
 * @param {string} s
 * @returns {string}
 */
export function safeDecodeURIComponent(s) {
  if (typeof s !== 'string') return s
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Normalizza host per confronto: trim, lowercase, rimuovi trailing dot.
 * @param {string} s
 * @returns {string}
 */
function normalizeHost(s) {
  if (typeof s !== 'string') return ''
  return s.trim().toLowerCase().replace(/\.+$/, '')
}

/**
 * Valida URL di return: solo https, host in allowlist. Rifiuta javascript:, data:, http:.
 * @param {string} raw - URL raw (può essere encoded)
 * @param {string} [allowedHostsCsv] - host consentiti separati da virgola (default da env FENAM_ALLOWED_RETURN_HOSTS)
 * @returns {{ ok: boolean, returnUrl?: string, error?: string }}
 */
export function validateReturnUrl(raw, allowedHostsCsv) {
  if (raw == null || typeof raw !== 'string') {
    return { ok: false, error: 'missing' }
  }
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, error: 'empty' }

  const toParse = safeDecodeURIComponent(trimmed)
  const lower = toParse.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('http:')) {
    return { ok: false, error: 'protocol' }
  }
  if (!lower.startsWith('https://')) return { ok: false, error: 'protocol' }

  let url
  try {
    url = new URL(toParse)
  } catch {
    return { ok: false, error: 'invalid' }
  }

  if (url.protocol !== 'https:') return { ok: false, error: 'protocol' }

  const hostname = normalizeHost(url.hostname)
  if (!hostname) return { ok: false, error: 'host' }

  const csv = allowedHostsCsv != null && typeof allowedHostsCsv === 'string'
    ? allowedHostsCsv
    : (typeof process !== 'undefined' && process.env && process.env.FENAM_ALLOWED_RETURN_HOSTS) || 'enotempo.it,www.enotempo.it'
  const allowed = csv.split(',').map((h) => normalizeHost(h)).filter(Boolean)
  if (!allowed.includes(hostname)) return { ok: false, error: 'host_not_allowed' }

  const returnUrl = url.toString().replace(/\/$/, '') || url.toString()
  return { ok: true, returnUrl }
}
