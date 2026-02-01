// lib/validateReturnUrl.js
// Valida URL di return per handoff FeNAM -> Enotempo
// Solo HTTPS, host in FENAM_ALLOWED_RETURN_HOSTS, ritorna URL normalizzato (stringa) o null.

/**
 * Valida e normalizza URL di return.
 * - Accetta solo https://
 * - Verifica l'host contro FENAM_ALLOWED_RETURN_HOSTS
 * - Ritorna URL normalizzato (stringa) o null
 *
 * @param {string|null|undefined} returnParam - URL di return da validare (può essere già encoded)
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

  let toParse = trimmed
  try {
    toParse = decodeURIComponent(trimmed)
  } catch {
    // mantieni trimmed se decode fallisce
  }

  try {
    const url = new URL(toParse)

    if (url.protocol !== 'https:') {
      return null
    }

    const allowedHosts = process.env.FENAM_ALLOWED_RETURN_HOSTS
      ? process.env.FENAM_ALLOWED_RETURN_HOSTS.split(',').map(h => h.trim()).filter(Boolean)
      : ['enotempo.it', 'www.enotempo.it']

    const hostname = url.hostname.toLowerCase()
    const hostnameWithoutWww = hostname.replace(/^www\./, '')
    const isAllowed = allowedHosts.some(allowed => {
      const a = allowed.toLowerCase().replace(/^www\./, '')
      return hostnameWithoutWww === a
    })

    if (!isAllowed) {
      return null
    }

    return url.toString().replace(/\/$/, '') || null
  } catch {
    return null
  }
}
