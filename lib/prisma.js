// lib/prisma.js
//
// IMPORTANTE: Questo progetto usa Supabase con Session Pooler per runtime.
// - Runtime (API routes) usa sempre DATABASE_URL (pooler su Vercel, porta 6543 / pgbouncer)
// - DIRECT_URL non è richiesta in produzione: usare solo DATABASE_URL e SKIP_MIGRATIONS=true
// - Migrazioni: da locale con DIRECT_URL (IPv4) o da Supabase SQL Editor
//
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Validazione DATABASE_URL all'avvio
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl || databaseUrl.trim() === '') {
  throw new Error(
    '❌ DATABASE_URL is missing or empty. Please configure DATABASE_URL environment variable.'
  )
}

/**
 * Valida la forma di DATABASE_URL senza esporre la URL completa.
 * Verifica che sia parseabile come URL e che la porta sia valida.
 */
function validateDatabaseUrlShape(url) {
  try {
    const parsed = new URL(url)
    const port = parsed.port
    
    // Se c'è una porta, verifica che sia un numero valido
    if (port && port !== '') {
      const portNum = parseInt(port, 10)
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return {
          valid: false,
          reason: `Invalid port number: "${port}" (must be 1-65535)`,
          host: parsed.hostname || 'unknown',
          port: port,
        }
      }
    }
    
    // Verifica che hostname sia presente
    if (!parsed.hostname || parsed.hostname.trim() === '') {
      return {
        valid: false,
        reason: 'Missing or empty hostname',
        host: 'unknown',
        port: port || 'default',
      }
    }
    
    return { valid: true }
  } catch (error) {
    // Se il parsing fallisce, prova a estrarre informazioni parziali
    let host = 'unknown'
    let port = 'unknown'
    
    try {
      // Prova a estrarre host:port con regex (non esponiamo la URL completa)
      const hostPortMatch = url.match(/@([^:/]+)(?::(\d+))?/)
      if (hostPortMatch) {
        host = hostPortMatch[1] || 'unknown'
        port = hostPortMatch[2] || 'default'
      }
    } catch {
      // Ignora errori di regex
    }
    
    return {
      valid: false,
      reason: `URL parsing failed: ${error.message}`,
      host,
      port,
    }
  }
}

// Valida forma DATABASE_URL (solo una volta)
if (!globalForPrisma._prismaDatabaseUrlValidationShown) {
  const validation = validateDatabaseUrlShape(databaseUrl)
  if (!validation.valid) {
    console.error(
      '❌ DATABASE_URL malformed:',
      validation.reason,
      `(host: ${validation.host}, port: ${validation.port})`
    )
    console.error(
      '💡 Suggestion: Check that DATABASE_URL has valid format:',
      'postgresql://user:password@host:port/database?params'
    )
    console.error(
      '   Common issues:',
      '- Invalid port number (must be 1-65535)',
      '- Special characters in password not URL-encoded',
      '- Missing @ separator between credentials and host'
    )
    globalForPrisma._prismaDatabaseUrlValidationShown = true
  }
}

/**
 * Helper di debug (solo development) per loggare informazioni derivate da DATABASE_URL
 * senza esporre la URL completa o password.
 */
if (process.env.NODE_ENV === 'development' && !globalForPrisma._prismaDatabaseUrlDebugShown) {
  try {
    const parsed = new URL(databaseUrl)
    const hostname = parsed.hostname || 'unknown'
    const port = parsed.port || (parsed.protocol === 'postgresql:' ? '5432' : 'default')
    const hasPgbouncer = databaseUrl.includes('pgbouncer=true')
    
    // Log informazioni base
    console.log('🔍 [DATABASE_URL Debug] Connection info:')
    console.log(`   Hostname: ${hostname}`)
    console.log(`   Port: ${port}`)
    console.log(`   pgbouncer=true: ${hasPgbouncer ? '✅' : '❌'}`)
    
    // Warning: pooler host con porta non pooler
    if (hostname.includes('pooler') && port !== '6543' && port !== 'default') {
      console.warn(
        '⚠️  [DATABASE_URL Debug] Pooler host con porta non pooler:',
        `hostname contiene "pooler" ma port è ${port} (atteso: 6543)`
      )
    }
    
    // Warning: manca pgbouncer=true
    if (!hasPgbouncer) {
      console.warn(
        '⚠️  [DATABASE_URL Debug] Manca pgbouncer=true:',
        'Per Supabase pooler, aggiungi ?pgbouncer=true o usa porta 6543'
      )
    }
    
    globalForPrisma._prismaDatabaseUrlDebugShown = true
  } catch (error) {
    // Se il parsing fallisce, non loggare (già gestito da validateDatabaseUrlShape)
    // Non settiamo il flag così può riprovare se la URL viene corretta
  }
}

// Log avvio DB (una volta, senza segreti): host, porta, ENV, SKIP_MIGRATIONS, modalità pooler vs direct
if (!globalForPrisma._prismaStartupLogShown) {
  try {
    const parsed = new URL(databaseUrl)
    const host = parsed.hostname || 'unknown'
    const port = parsed.port || (parsed.protocol === 'postgresql:' ? '5432' : 'default')
    const isPooler =
      host.includes('pooler') ||
      port === '6543' ||
      databaseUrl.includes('pgbouncer=true')
    const skipMigrations = process.env.SKIP_MIGRATIONS === 'true'
    const mode = isPooler ? 'pooler' : 'direct'
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
    console.log(
      `[Prisma] DB: host=${host} port=${port} mode=${mode} | ENV=${env} SKIP_MIGRATIONS=${skipMigrations ? 'true' : 'false'}`
    )
    globalForPrisma._prismaStartupLogShown = true
  } catch {
    // non loggare se parsing fallisce
  }
}

// Warning se DATABASE_URL punta ancora a Prisma Accelerate (solo una volta)
if (!globalForPrisma._prismaAccelerateWarningShown) {
  if (databaseUrl.includes('accelerate.prisma-data.net')) {
    console.warn(
      '⚠️  WARNING: DATABASE_URL points to Prisma Accelerate (accelerate.prisma-data.net).',
      'For Supabase pooler-only deployment, use the Supabase pooler connection string instead.',
      'See docs/DEPLOY_SUPABASE_POOLER_ONLY.md for details.'
    )
    globalForPrisma._prismaAccelerateWarningShown = true
  }
}

// Verifica che DATABASE_URL usi il pooler (pgbouncer=true o porta 6543)
if (!globalForPrisma._prismaPoolerWarningShown) {
  const hasPgbouncer = databaseUrl.includes('pgbouncer=true')
  const hasPoolerPort = databaseUrl.includes(':6543/') || databaseUrl.includes(':6543?')
  const isUsingPooler = hasPgbouncer || hasPoolerPort

  if (!isUsingPooler) {
    console.warn(
      '⚠️  WARNING: DATABASE_URL does not appear to use a pooler connection.',
      'Missing pgbouncer=true parameter or port 6543.',
      'Using a non-pooler connection on Vercel (serverless) may cause connection limit issues.',
      'For Supabase, use the pooler connection string with port 6543 or pgbouncer=true.',
      'See docs/DEPLOY_SUPABASE_POOLER_ONLY.md for details.'
    )
    globalForPrisma._prismaPoolerWarningShown = true
  }
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
