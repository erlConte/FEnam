// lib/validateReturnUrl.js
// Wrapper per compatibilità: delega a lib/returnUrl.validateReturnUrl. Ritorna URL normalizzato o null.
// Nessun PII nei log.

import { validateReturnUrl as validate } from './returnUrl'

const defaultHosts = 'enotempo.it,www.enotempo.it'

/**
 * Valida e normalizza URL di return (solo https, host in allowlist).
 * @param {string|null|undefined} returnParam
 * @returns {string|null}
 */
export function getSafeReturnUrl(returnParam) {
  if (returnParam == null || typeof returnParam !== 'string') return null
  const trimmed = returnParam.trim()
  if (trimmed === '') return null
  const allowedHosts = process.env.FENAM_ALLOWED_RETURN_HOSTS || defaultHosts
  const result = validate(trimmed, allowedHosts)
  return result.ok ? result.returnUrl ?? null : null
}
