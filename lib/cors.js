// lib/cors.js
// Helper per gestione CORS nelle API routes

/**
 * Configurazione CORS per le API
 */
// CORS: usa ALLOWED_ORIGINS come fonte primaria, fallback a default
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : process.env.NODE_ENV === 'production'
  ? ['https://fenam.website', 'https://www.fenam.website']
  : ['http://localhost:3000', 'http://localhost:3001']

/**
 * Verifica se l'origine della richiesta è consentita
 * @param {string} origin - Origin header della richiesta
 * @returns {boolean}
 */
export function isOriginAllowed(origin) {
  if (!origin) return false
  return allowedOrigins.some((allowed) => {
    // Match esatto o subdomain
    return origin === allowed || origin.endsWith(`.${allowed.replace(/^https?:\/\//, '')}`)
  })
}

/**
 * Applica header CORS alla risposta
 * @param {import('next').NextApiResponse} res
 * @param {string} origin - Origin della richiesta
 */
export function setCorsHeaders(res, origin) {
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Max-Age', '86400') // 24 ore
  }
}

/**
 * Gestisce preflight OPTIONS request
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {boolean} true se la richiesta è stata gestita (OPTIONS)
 */
export function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin
    setCorsHeaders(res, origin)
    res.status(200).end()
    return true
  }

  // Per richieste non-OPTIONS, verifica origin se presente
  const origin = req.headers.origin
  if (origin && !isOriginAllowed(origin)) {
    res.status(403).json({ error: 'Origin not allowed' })
    return true
  }

  // Imposta header CORS anche per richieste normali
  if (origin) {
    setCorsHeaders(res, origin)
  }

  return false
}
