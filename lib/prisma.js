// lib/prisma.js
//
// IMPORTANTE: Questo progetto usa Supabase pooler-only (PgBouncer).
// - Le migrazioni vanno eseguite manualmente via Supabase SQL Editor
// - Prisma migrate (deploy/push) NON va usato in produzione
// - Vedi docs/DEPLOY_SUPABASE_POOLER_ONLY.md per dettagli
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
