// lib/cors.js
// Helper per gestione CORS nelle API routes

/**
 * Costruisce la lista di origin consentite da ENV o fallback
 * - ALLOWED_ORIGINS: lista separata da virgola di origin completi (https://...)
 * - In prod fallback su fenam.website
 * - In dev fallback su localhost
 */
function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  }

  if (process.env.NODE_ENV === 'production') {
    return ['https://fenam.website', 'https://www.fenam.website']
  }

  return ['http://localhost:3000', 'http://localhost:3001']
}

/**
 * Verifica se l'origine della richiesta è consentita
 * Regole:
 * - se origin manca o è "null" -> non bloccare (utile per server-to-server / alcune condizioni browser)
 * - consenti SEMPRE i preview Vercel (*.vercel.app)
 * - consenti match esatto con allowedOrigins
 * - consenti anche sottodomini dell'allowed (es: foo.example.com se allowed è https://example.com)
 *
 * @param {string | undefined} origin
 * @returns {boolean}
 */
export function isOriginAllowed(origin) {
  if (!origin || origin === 'null') return true

  // Allow Vercel preview deployments senza dover aggiornare env ogni volta
  try {
    const { hostname } = new URL(origin)
    if (hostname && hostname.endsWith('.vercel.app')) return true
  } catch (_) {
    // origin malformata: trattala come non consentita
    return false
  }

  const allowedOrigins = getAllowedOrigins()

  return allowedOrigins.some((allowed) => {
    if (origin === allowed) return true

    // Match sottodominio: origin endsWith ".example.com" se allowed è "https://example.com"
    const allowedHost = allowed.replace(/^https?:\/\//, '')
    return origin.endsWith(`.${allowedHost}`)
  })
}

/**
 * Applica header CORS alla risposta
 * @param {import('next').NextApiResponse} res
 * @param {string | undefined} origin
 */
export function setCorsHeaders(res, origin) {
  if (!origin || origin === 'null') return
  if (!isOriginAllowed(origin)) return

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin') // importante con cache/proxy
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-correlation-id'
  )
  res.setHeader('Access-Control-Max-Age', '86400') // 24 ore
}

/**
 * Gestisce CORS per API routes
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @returns {boolean} true se la richiesta è stata gestita (bloccata o OPTIONS)
 */
export function handleCors(req, res) {
  const origin = req.headers.origin

  // Preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin)
    res.status(200).end()
    return true
  }

  // Se c'è Origin e non è consentita -> 403
  if (origin && !isOriginAllowed(origin)) {
    console.warn('[CORS] Origin blocked', { origin, path: req.url })
    res.status(403).json({ error: 'Origin not allowed' })
    return true
  }

  // Imposta header CORS per richieste normali
  setCorsHeaders(res, origin)
  return false
}
