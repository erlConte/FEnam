// lib/apiHelpers.js
// Helper comuni per API routes

import { logger } from './logger'

/**
 * Risposta di errore standardizzata
 * @param {import('next').NextApiResponse} res
 * @param {number} statusCode
 * @param {string} error - Codice errore
 * @param {string} message - Messaggio errore
 * @param {object|array} details - Dettagli aggiuntivi (opzionale)
 */
export function sendError(res, statusCode, error, message, details = null) {
  const response = {
    error,
    ...(message && { message }),
  }
  if (details) {
    response.details = details
  }
  return res.status(statusCode).json(response)
}

/**
 * Risposta di successo standardizzata
 * @param {import('next').NextApiResponse} res
 * @param {object} data - Dati da restituire
 * @param {number} statusCode - Status code (default: 200)
 */
export function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json(data)
}

/**
 * Verifica metodo HTTP consentito
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {string[]} allowedMethods - Metodi consentiti
 * @returns {boolean} true se il metodo è consentito
 */
export function checkMethod(req, res, allowedMethods) {
  if (!allowedMethods.includes(req.method)) {
    sendError(res, 405, 'Method not allowed', `Metodo ${req.method} non consentito. Metodi consentiti: ${allowedMethods.join(', ')}`)
    return false
  }
  return true
}

/**
 * Estrae token da Authorization header (solo header, non query string)
 * @param {import('next').NextApiRequest} req
 * @returns {string|null}
 */
export function getAuthToken(req) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

/**
 * Verifica token admin
 * @param {string} token
 * @returns {boolean}
 */
export function verifyAdminToken(token) {
  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken) {
    logger.error('[Admin Auth] ADMIN_TOKEN non configurato')
    return false
  }
  return token === adminToken
}

/**
 * Middleware per autenticazione admin
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {boolean} true se autenticato, false altrimenti
 */
export function requireAdminAuth(req, res) {
  const token = getAuthToken(req)
  if (!token || !verifyAdminToken(token)) {
    sendError(res, 401, 'Unauthorized', 'Token non valido o mancante. Usa header Authorization: Bearer <token>')
    return false
  }
  return true
}

/**
 * Middleware per proteggere endpoint dev
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {boolean} true se l'endpoint è accessibile
 */
export function requireDev(req, res) {
  // Solo in development
  if (process.env.NODE_ENV !== 'development') {
    sendError(res, 404, 'Not found', 'Endpoint disponibile solo in development')
    return false
  }

  // Protezione aggiuntiva: richiedi header segreto se configurato
  const devKey = process.env.DEV_ONLY_KEY
  if (devKey) {
    const providedKey = req.headers['x-dev-key']
    if (!providedKey || providedKey !== devKey) {
      sendError(res, 403, 'Forbidden', 'Dev key richiesta')
      return false
    }
  }

  return true
}
