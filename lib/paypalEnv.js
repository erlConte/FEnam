/**
 * Helper per ambiente PayPal (sandbox vs live).
 * Ordine: PAYPAL_ENV (production|sandbox) > NODE_ENV (production => live, altrimenti sandbox).
 * Coerenza: usare lo stesso client ID per NEXT_PUBLIC_PAYPAL_CLIENT_ID (frontend) e PAYPAL_CLIENT_ID (server).
 */

import paypal from '@paypal/checkout-server-sdk'
import { logger } from './logger'

const PAYPAL_BASE_URL_LIVE = 'https://api.paypal.com'
const PAYPAL_BASE_URL_SANDBOX = 'https://api.sandbox.paypal.com'

/**
 * Determina se usare ambiente live (true) o sandbox (false).
 * PAYPAL_ENV=production => live, PAYPAL_ENV=sandbox => sandbox.
 * Se PAYPAL_ENV non è impostato: NODE_ENV=production => live, altrimenti sandbox.
 */
export function isPayPalLive() {
  const paypalEnv = (process.env.PAYPAL_ENV || '').toLowerCase()
  if (paypalEnv === 'production') return true
  if (paypalEnv === 'sandbox') return false
  return process.env.NODE_ENV === 'production'
}

/**
 * Restituisce la base URL PayPal usata dal server (senza segreti, per log).
 */
export function getPayPalBaseUrl() {
  return isPayPalLive() ? PAYPAL_BASE_URL_LIVE : PAYPAL_BASE_URL_SANDBOX
}

/**
 * Crea l'ambiente PayPal SDK e il client.
 * Logga quale base URL sta usando il server (senza client_id/secret).
 */
export function createPayPalClient() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return { client: null, baseUrl: null, mode: null }
  }

  const live = isPayPalLive()
  const mode = live ? 'live' : 'sandbox'
  const baseUrl = getPayPalBaseUrl()

  const environment = live
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )

  const client = new paypal.core.PayPalHttpClient(environment)

  // Log senza segreti: quale base URL usa il server
  const publicIdLen = process.env.PAYPAL_CLIENT_ID ? String(process.env.PAYPAL_CLIENT_ID).length : 0
  const nextPublicLen = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? String(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID).length : 0
  logger.info('[PayPal] Server PayPal env', {
    paypalBaseUrl: baseUrl,
    paypalMode: mode,
    paypalEnv: process.env.PAYPAL_ENV || '(not set, using NODE_ENV)',
    clientIdLength: publicIdLen,
    nextPublicPaypalClientIdLength: nextPublicLen,
    hint: 'NEXT_PUBLIC_PAYPAL_CLIENT_ID (frontend) deve coincidere con PAYPAL_CLIENT_ID (server)',
  })

  return { client, baseUrl, mode }
}
