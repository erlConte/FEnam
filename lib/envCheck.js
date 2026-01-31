// lib/envCheck.js
// Controllo centralizzato delle env vars critiche (production-safe)

import { logger } from './logger'

/**
 * Env vars critiche richieste per produzione
 */
// FENAM_HANDOFF_SECRET: opzionale; richiesto solo se si usa handoff (ENOTEMPO_HANDOFF_URL)
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'ADMIN_TOKEN',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
  'NEXT_PUBLIC_BASE_URL',
  'RESEND_API_KEY',
  'SENDER_EMAIL',
]

/**
 * Verifica che tutte le env vars critiche siano presenti
 * @returns {object} { valid: boolean, missing: string[] }
 */
export function validateEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter((key) => {
    const value = process.env[key]
    return !value || value.trim() === ''
  })

  if (missing.length > 0) {
    // Log solo nomi variabili, mai valori
    logger.error('[Env Check] Variabili ambiente mancanti:', {
      missing,
    })
    return { valid: false, missing }
  }

  return { valid: true, missing: [] }
}

/**
 * Middleware per API routes: verifica env vars e ritorna errore se mancanti
 * NON crasha il build, solo le API routes falliscono
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {boolean} true se env vars sono ok, false se mancanti (risposta già inviata)
 */
export function requireEnvVars(req, res) {
  const { valid, missing } = validateEnvVars()
  
  if (!valid) {
    logger.error(`[Env Check] API ${req.url} richiede env vars mancanti: ${missing.join(', ')}`)
    res.status(500).json({
      error: 'Configuration error',
      message: 'Server configuration incomplete',
    })
    return false
  }
  
  return true
}
