/**
 * Helper per ambiente PayPal (sandbox vs live).
 * Ordine: PAYPAL_ENV (production|sandbox) > NODE_ENV (production => live, altrimenti sandbox).
 * Coerenza: usare lo stesso client ID per NEXT_PUBLIC_PAYPAL_CLIENT_ID (frontend) e PAYPAL_CLIENT_ID (server).
 *
 * TODO P0: Mismatch NEXT_PUBLIC_PAYPAL_CLIENT_ID e PAYPAL_CLIENT_ID (sandbox vs live) causa bottone che crea ordine su un ambiente e capture su altro → fallimento.
 * TODO P1: PAYPAL_ENV errato (es. sandbox in prod) forza modalità sbagliata; verificare in Vercel.
 * TODO P1: Currency/amount non accettati dal conto PayPal → errore da API; non controllabile qui (log in paypal/capture).
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

  // Log senza segreti: base URL, mode, coerenza client ID (solo prefix + len per verificare match)
  const serverId = process.env.PAYPAL_CLIENT_ID || ''
  const nextPublicId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''
  const serverIdLen = serverId.length
  const nextPublicLen = nextPublicId.length
  const serverIdPrefix = serverIdLen >= 4 ? serverId.slice(0, 4) : '(len<4)'
  const nextPublicPrefix = nextPublicLen >= 4 ? nextPublicId.slice(0, 4) : '(len<4)'
  const idsMatch = serverIdLen === nextPublicLen && serverIdPrefix === nextPublicPrefix

  logger.info('[PayPal] Server PayPal env', {
    paypalBaseUrl: baseUrl,
    paypalMode: mode,
    paypalEnv: process.env.PAYPAL_ENV || '(not set, using NODE_ENV)',
    PAYPAL_CLIENT_ID_prefix: serverIdPrefix,
    PAYPAL_CLIENT_ID_length: serverIdLen,
    NEXT_PUBLIC_PAYPAL_CLIENT_ID_prefix: nextPublicPrefix,
    NEXT_PUBLIC_PAYPAL_CLIENT_ID_length: nextPublicLen,
    clientIdsMatch: idsMatch,
    hint: idsMatch ? 'Frontend e server usano stesso client ID' : 'ATTENZIONE: prefix/len diversi — verifica NEXT_PUBLIC_PAYPAL_CLIENT_ID = PAYPAL_CLIENT_ID su Vercel',
  })

  return { client, baseUrl, mode }
}
