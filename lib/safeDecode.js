// lib/safeDecode.js
// Decode URI component una sola volta, senza PII in log. Usabile client e server.

/**
 * Decodifica una volta; se fallisce (es. già decodificato o % malformato) ritorna l'input.
 * Non fare mai decode due volte su stesso valore.
 * @param {string} s
 * @returns {string}
 */
export function safeDecodeOnce(s) {
  if (typeof s !== 'string') return s
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/**
 * Estrae una stringa singola da router.query[key]; gestisce array (prende primo elemento).
 * Non decodifica: il valore va passato raw all'API; validazione lato server.
 * @param {Record<string, unknown>} query - router.query
 * @param {string} key
 * @returns {string}
 */
export function getQueryString(query, key) {
  if (!query || typeof query !== 'object') return ''
  const v = query[key]
  if (v == null) return ''
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
  return typeof v === 'string' ? v : ''
}
