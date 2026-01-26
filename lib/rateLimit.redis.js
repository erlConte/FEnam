// lib/rateLimit.redis.js
// Rate limiter serverless-compatible con Upstash Redis
// 
// INSTALLAZIONE:
// npm install @upstash/redis
//
// CONFIGURAZIONE:
// Aggiungi in .env:
// UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
// UPSTASH_REDIS_REST_TOKEN=your-token
//
// USO:
// import { rateLimit } from './rateLimit.redis'
// const allowed = await rateLimit(req, res, { maxRequests: 10, windowMs: 60000 })

import { Redis } from '@upstash/redis'

// Inizializza Redis (opzionale, non blocca se manca)
let redis = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  } catch (error) {
    console.error('[Rate Limit Redis] Errore inizializzazione Redis:', error.message)
  }
}

/**
 * Estrae l'IP reale dalla richiesta, compatibile con Vercel/proxy
 * @param {import('next').NextApiRequest} req
 * @returns {string}
 */
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim())
    return ips[0]
  }
  const realIP = req.headers['x-real-ip']
  if (realIP) return realIP
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Rate limiter con fixed window usando Redis
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {object} options
 * @param {number} options.maxRequests - Numero massimo richieste (default: 10)
 * @param {number} options.windowMs - Finestra temporale in ms (default: 60000)
 * @returns {Promise<boolean>} true se permesso, false se rate limited
 */
export async function rateLimit(req, res, options = {}) {
  const { maxRequests = 10, windowMs = 60 * 1000 } = options

  // Se Redis non configurato, fallback a "allow all" (log warning)
  if (!redis) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Rate Limit] Redis non configurato, rate limiting disabilitato')
    }
    return true
  }

  const ip = getClientIP(req)
  const key = `rate_limit:${ip}`
  const now = Date.now()
  const windowStart = Math.floor(now / windowMs) * windowMs
  const redisKey = `${key}:${windowStart}`

  try {
    // Usa pipeline Redis per atomicità
    const pipeline = redis.pipeline()
    pipeline.incr(redisKey)
    pipeline.expire(redisKey, Math.ceil(windowMs / 1000))
    const results = await pipeline.exec()

    const count = results[0]?.result || 0

    if (count > maxRequests) {
      const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000)
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `⚠️ [Rate Limit] IP ${ip} ha superato il limite di ${maxRequests} richieste/minuto. Retry after ${retryAfter}s`
        )
      }

      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
      })
      res.setHeader('Retry-After', retryAfter.toString())
      return false
    }

    return true
  } catch (error) {
    // Se Redis fallisce, logga ma permetti richiesta (fail open)
    console.error('[Rate Limit] Redis error:', error.message)
    // In produzione, potresti voler fallire chiuso (return false) invece
    return true
  }
}

/**
 * Crea un rate limiter custom (per backward compatibility)
 * @deprecated Usa rateLimit direttamente
 */
export function createRateLimiter(maxRequests, windowMs) {
  return {
    check: async (ip) => {
      // Non usato con Redis, ma mantieni per compatibilità
      return { allowed: true, retryAfterSeconds: 0 }
    },
  }
}
