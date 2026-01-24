// lib/validateReturnUrl.js
// Valida URL di return per handoff FeNAM -> Enotempo

/**
 * Valida e normalizza URL di return
 * Consente solo HTTPS e host in allowlist
 * 
 * @param {string|null} returnParam - URL di return da validare
 * @returns {string|null} URL validato o null se non valido
 */
export function getSafeReturnUrl(returnParam) {
  if (!returnParam) {
    return null
  }

  try {
    // Costruisci URL
    const url = new URL(returnParam)

    // Solo HTTPS
    if (url.protocol !== 'https:') {
      console.warn(`[ValidateReturnUrl] Protocollo non HTTPS: ${url.protocol}`)
      return null
    }

    // Allowlist host
    const allowedHosts = process.env.FENAM_ALLOWED_RETURN_HOSTS
      ? process.env.FENAM_ALLOWED_RETURN_HOSTS.split(',').map(h => h.trim())
      : ['enotempo.it', 'www.enotempo.it'] // Default hardcoded

    const hostname = url.hostname.toLowerCase()

    // Rimuovi www. per confronto
    const hostnameWithoutWww = hostname.replace(/^www\./, '')
    const isAllowed = allowedHosts.some(allowed => {
      const allowedWithoutWww = allowed.toLowerCase().replace(/^www\./, '')
      return hostnameWithoutWww === allowedWithoutWww
    })

    if (!isAllowed) {
      console.warn(`[ValidateReturnUrl] Host non consentito: ${hostname}`)
      return null
    }

    // Ritorna URL normalizzato (senza trailing slash se presente)
    return url.toString().replace(/\/$/, '')
  } catch (error) {
    // URL non valido
    console.warn(`[ValidateReturnUrl] URL non valido: ${returnParam}`, error.message)
    return null
  }
}
