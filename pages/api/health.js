// pages/api/health.js
// Health check endpoint per monitoraggio

import { prisma } from '../../lib/prisma'
import { sendSuccess, sendError } from '../../lib/apiHelpers'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const checks = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    checks: {},
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.checks.database = { status: 'ok' }
  } catch (error) {
    checks.checks.database = {
      status: 'error',
      error: error.message,
    }
    checks.status = 'degraded'
  }

  // Check env vars critiche (senza esporre valori)
  const requiredEnvVars = [
    'DATABASE_URL',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'ADMIN_TOKEN',
    'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
    'NEXT_PUBLIC_BASE_URL',
    'FENAM_HANDOFF_SECRET',
    'RESEND_API_KEY',
    'SENDER_EMAIL',
  ]
  
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key])
  if (missingEnvVars.length > 0) {
    checks.checks.env = {
      status: 'error',
      missing: missingEnvVars,
    }
    checks.status = 'degraded'
  } else {
    checks.checks.env = { status: 'ok' }
  }

  // Check PayPal mode (live/sandbox)
  const paypalClientId = process.env.PAYPAL_CLIENT_ID
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (paypalClientId && paypalClientSecret) {
    checks.checks.paypalMode = process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'
  } else {
    checks.checks.paypalMode = 'not_configured'
  }

  // Check Resend configuration
  const resendApiKey = process.env.RESEND_API_KEY
  const senderEmail = process.env.SENDER_EMAIL
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const resendConfigured = !!(resendApiKey && senderEmail && emailRegex.test(senderEmail))
  checks.checks.resendConfigured = resendConfigured

  // Check env vars opzionali
  const optionalEnvVars = {
    ENOTEMPO_HANDOFF_URL: process.env.ENOTEMPO_HANDOFF_URL ? 'configured' : 'not_configured',
  }
  checks.checks.optionalEnv = optionalEnvVars
  
  // Check handoff configuration (già presente in optionalEnv, ma aggiungiamo anche qui per chiarezza)
  checks.checks.handoffConfigured = !!process.env.ENOTEMPO_HANDOFF_URL

  // Check Redis (opzionale, non blocca se manca)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    checks.checks.redis = { status: 'configured' }
  } else {
    checks.checks.redis = { status: 'not_configured' }
  }

  const statusCode = checks.status === 'ok' ? 200 : 503
  return res.status(statusCode).json(checks)
}
