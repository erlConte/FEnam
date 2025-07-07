import paypal from '@paypal/checkout-server-sdk'

const environment = new paypal.core.LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_CLIENT_SECRET
)
const client = new paypal.core.PayPalHttpClient(environment)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { nome, cognome, email, telefono, donazione = 0 } = req.body
    const extra = Math.max(parseFloat(donazione) || 0, 0)          // >= 0
    const total = (85 + extra).toFixed(2)                           // string «xx.xx»

    // ① crea ordine PayPal
    const request = new paypal.orders.OrdersCreateRequest()
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: 'EUR', value: total },
          description:
            extra > 0
              ? `Affiliazione €85 + Donazione €${extra.toFixed(2)}`
              : 'Affiliazione €85',
        },
      ],
    })
    const order = await client.execute(request)

    // ② (facoltativo) salva nel DB dati + orderId + total …

    return res.status(200).json({ orderID: order.result.id })
  } catch (err) {
    console.error('❌ [PayPal API] error:', err)
    return res.status(500).json({ error: 'PayPal error' })
  }
}
