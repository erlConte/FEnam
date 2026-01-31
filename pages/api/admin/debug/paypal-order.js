// pages/api/admin/debug/paypal-order.js
// Endpoint admin-only: GET ordine PayPal per orderId. Serve a capire se PayPal ha catturato ma DB è pending.

import paypal from '@paypal/checkout-server-sdk'
import { createPayPalClient, getPayPalBaseUrl, isPayPalLive } from '../../../../lib/paypalEnv'
import { checkMethod, requireAdminAuth, sendError, sendSuccess } from '../../../../lib/apiHelpers'
import { handleCors } from '../../../../lib/cors'
import { logger } from '../../../../lib/logger'

const { client } = createPayPalClient()

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (!checkMethod(req, res, ['GET'])) return
  if (!requireAdminAuth(req, res)) return

  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : null
  if (!orderId) {
    return sendError(res, 400, 'Validation error', 'Query orderId obbligatorio')
  }

  if (!client) {
    logger.error('[Admin Debug PayPal] PayPal non configurato')
    return sendError(res, 503, 'Service unavailable', 'PayPal non configurato')
  }

  try {
    const getRequest = new paypal.orders.OrdersGetRequest(orderId)
    const response = await client.execute(getRequest)
    const order = response.result

    const status = order.status || null
    let captureStatus = null
    const purchaseUnits = []

    if (order.purchase_units && order.purchase_units.length > 0) {
      for (const pu of order.purchase_units) {
        const captures = pu.payments?.captures?.map((c) => ({
          id: c.id || null,
          status: c.status || null,
          amount: c.amount?.value ?? null,
          currency: c.amount?.currency_code ?? null,
        })) ?? []
        purchaseUnits.push({
          reference_id: pu.reference_id || null,
          amount: pu.amount?.value ?? null,
          currency: pu.amount?.currency_code ?? null,
          captures,
        })
      }
      const first = order.purchase_units[0]
      if (first.payments?.captures?.length > 0) {
        captureStatus = first.payments.captures[0].status || null
      }
    }

    logger.info('[Admin Debug PayPal] GET order', {
      orderId,
      paypalMode: isPayPalLive() ? 'live' : 'sandbox',
      paypalBaseUrl: getPayPalBaseUrl(),
      status,
      captureStatus,
    })

    return sendSuccess(res, {
      orderId,
      status,
      captureStatus,
      paypalMode: isPayPalLive() ? 'live' : 'sandbox',
      paypalBaseUrl: getPayPalBaseUrl(),
      purchase_units: purchaseUnits,
    })
  } catch (err) {
    logger.error('[Admin Debug PayPal] Errore GET order', {
      orderId,
      error: err.message,
      statusCode: err.statusCode,
    })
    return sendError(res, 502, 'PayPal error', err.message || 'Errore durante la lettura ordine PayPal.')
  }
}
