// pages/api/affiliazione/paypal.js
import PayPal from '@paypal/checkout-server-sdk'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req, res) {
  console.log('▶️ [PayPal API] NODE_ENV:', process.env.NODE_ENV)
  console.log('▶️ [PayPal API] PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID)
  console.log('▶️ [PayPal API] PAYPAL_CLIENT_SECRET present?', !!process.env.PAYPAL_CLIENT_SECRET)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { nome, cognome, email, telefono, privacy } = req.body
  if (!nome || !cognome || !email || !telefono || privacy !== true) {
    return res.status(400).json({ error: 'Dati mancanti o consenso non dato' })
  }

  // Salva prima la richiesta in DB
  let affiliation
  try {
    affiliation = await prisma.affiliation.create({
      data: { nome, cognome, email, telefono, privacy }
    })
  } catch (dbErr) {
    console.error('❌ [PayPal API] Errore salvataggio DB:', dbErr)
    return res.status(500).json({ error: 'Errore interno al server' })
  }

  // Scegli environment sandbox vs live
  const environment =
    process.env.NODE_ENV === 'production'
      ? new PayPal.core.LiveEnvironment(
          process.env.PAYPAL_CLIENT_ID,
          process.env.PAYPAL_CLIENT_SECRET
        )
      : new PayPal.core.SandboxEnvironment(
          process.env.PAYPAL_CLIENT_ID,
          process.env.PAYPAL_CLIENT_SECRET
        )
  const client = new PayPal.core.PayPalHttpClient(environment)

  try {
    // *** crea la request per PayPal ***
    const createOrderRequest = new PayPal.orders.OrdersCreateRequest()
    createOrderRequest.prefer('return=representation')
    createOrderRequest.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: 'Affiliazione F.E.N.A.M. – Carta Imprese',
          amount: { currency_code: 'EUR', value: '85.00' },
          custom_id: affiliation.id
        }
      ],
      application_context: {
        brand_name: 'F.E.N.A.M.',
        user_action: 'PAY_NOW',
        return_url: `${req.headers.origin}/affiliazione?success=true`,
        cancel_url: `${req.headers.origin}/affiliazione?canceled=true`,
      },
    })

    // *** esegui la request ***
    const order = await client.execute(createOrderRequest)
    console.log('✅ [PayPal API] order created:', order.result)

    // Aggiorna il record con l’orderId
    await prisma.affiliation.update({
      where: { id: affiliation.id },
      data: { orderId: order.result.id }
    })

    return res.status(200).json({ orderID: order.result.id })
  } catch (err) {
    console.error('❌ [PayPal API] error full object:', err)
    if (err.statusCode && err._originalError?.response) {
      console.error(
        '❌ [PayPal API] response body:',
        await err._originalError.response.text()
      )
    }
    return res.status(500).json({ error: 'Errore durante la creazione dell’ordine' })
  }
}
