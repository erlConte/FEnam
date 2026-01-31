// lib/rateLimit.js
// Rate limiter in-memory con fixed window

/**
 * Estrae l'IP reale dalla richiesta, compatibile con Vercel/proxy
 * @param {import('next').NextApiRequest} req
 * @returns {string}
 */
function getClientIP(req) {
  // Vercel e proxy passano l'IP in x-forwarded-for
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    // x-forwarded-for può contenere più IP separati da virgola (client, proxy1, proxy2)
    // Prendiamo il primo (IP originale del client)
    const ips = forwarded.split(',').map((ip) => ip.trim())
    return ips[0]
  }

  // Fallback su x-real-ip (alcuni proxy usano questo)
  const realIP = req.headers['x-real-ip']
  if (realIP) {
    return realIP
  }

  // Ultimo fallback: socket remote address
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Rate limiter con fixed window
 * Mantiene contatori per IP in memoria (non persistente)
 */
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60 * 1000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    // Map: IP -> { count: number, resetAt: timestamp }
    this.counters = new Map()

    // Cleanup automatico ogni 5 minuti per evitare memory leak
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.cleanup()
      }, 5 * 60 * 1000)
    }
  }

  /**
   * Verifica se una richiesta è permessa
   * @param {string} ip - IP del client
   * @returns {{ allowed: boolean, retryAfterSeconds: number }}
   */
  check(ip) {
    const now = Date.now()
    const record = this.counters.get(ip)

    // Se non esiste record o finestra scaduta, reset
    if (!record || now >= record.resetAt) {
      this.counters.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
      })
      return { allowed: true, retryAfterSeconds: 0 }
    }

    // Incrementa contatore
    record.count++

    // Se supera il limite
    if (record.count > this.maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000)
      return { allowed: false, retryAfterSeconds: retryAfter }
    }

    return { allowed: true, retryAfterSeconds: 0 }
  }

  /**
   * Rimuove record scaduti per evitare memory leak
   */
  cleanup() {
    const now = Date.now()
    for (const [ip, record] of this.counters.entries()) {
      if (now >= record.resetAt) {
        this.counters.delete(ip)
      }
    }
  }
}

// Istanza globale del rate limiter (10 richieste per minuto)
const defaultLimiter = new RateLimiter(10, 60 * 1000)

// Cache di limiter per coppia (maxRequests, windowMs): evita di creare limiter esterni ovunque
const limitersByKey = new Map()

function getLimiterForOptions(maxRequests, windowMs) {
  const key = `${maxRequests}-${windowMs}`
  if (!limitersByKey.has(key)) {
    limitersByKey.set(key, new RateLimiter(maxRequests, windowMs))
  }
  return limitersByKey.get(key)
}

/**
 * Middleware rate limiter per Next.js API routes
 * Se passi maxRequests e windowMs (senza limiter), usa un limiter memoizzato per quella coppia.
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {object} options - Opzioni per il rate limiter
 * @param {number} options.maxRequests - Numero massimo di richieste (default: 10)
 * @param {number} options.windowMs - Finestra temporale in millisecondi (default: 60000 = 1 minuto)
 * @param {RateLimiter} options.limiter - Istanza custom del limiter (opzionale, sovrascrive maxRequests/windowMs)
 * @returns {Promise<boolean>} - true se la richiesta è permessa, false se rate limited
 */
export async function rateLimit(req, res, options = {}) {
  const {
    maxRequests = 10,
    windowMs = 60 * 1000,
    limiter: customLimiter,
  } = options

  const limiter = customLimiter ?? (options.maxRequests !== undefined || options.windowMs !== undefined
    ? getLimiterForOptions(maxRequests, windowMs)
    : defaultLimiter)

  const ip = getClientIP(req)
  const { allowed, retryAfterSeconds } = limiter.check(ip)

  if (!allowed) {
    // Log sempre (senza IP in prod per evitare PII): utile per debug 429 in test/preview
    console.warn('[Rate Limit] Request rate limited', {
      retryAfterSeconds,
      maxRequests,
      windowMs,
      path: req.url,
    })

    res.status(429).json({
      error: 'Too many requests',
      message: `Limite di ${maxRequests} richieste al minuto superato. Riprova tra ${retryAfterSeconds} secondi.`,
      retryAfter: retryAfterSeconds,
    })
    res.setHeader('Retry-After', retryAfterSeconds.toString())
    return false
  }

  return true
}

/**
 * Crea un nuovo rate limiter con configurazione custom
 * @param {number} maxRequests
 * @param {number} windowMs
 * @returns {RateLimiter}
 */
export function createRateLimiter(maxRequests, windowMs) {
  return new RateLimiter(maxRequests, windowMs)
}
