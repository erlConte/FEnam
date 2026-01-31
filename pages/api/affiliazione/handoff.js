// pages/api/affiliazione/handoff.js
// API per generare token handoff e ritornare URL di redirect

import { createHandoffToken } from '../../../lib/handoffToken'
import { getSafeReturnUrl } from '../../../lib/validateReturnUrl'
import { prisma } from '../../../lib/prisma'
import { z } from 'zod'

const handoffSchema = z.object({
  orderID: z.string().min(1, 'OrderID obbligatorio'),
  returnUrl: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.FENAM_HANDOFF_SECRET || process.env.FENAM_HANDOFF_SECRET.trim() === '') {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Handoff non configurato (FENAM_HANDOFF_SECRET mancante)',
    })
  }

  let orderIDForLog = null

  try {
    // Validazione input
    const parseResult = handoffSchema.safeParse(req.body)
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]
      return res.status(400).json({
        error: firstError.message || 'Validazione fallita',
        details: parseResult.error.errors,
      })
    }

    const { orderID, returnUrl, source } = parseResult.data
    orderIDForLog = orderID

    // Verifica che l'affiliazione esista e sia completata
    const affiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
      select: {
        id: true,
        memberNumber: true,
        status: true,
      },
    })

    if (!affiliation) {
      return res.status(404).json({
        error: 'Affiliazione non trovata',
      })
    }

    if (affiliation.status !== 'completed') {
      return res.status(400).json({
        error: 'Affiliazione non completata',
        details: 'L\'affiliazione deve essere completata per generare il token di handoff',
      })
    }

    // Valida URL di return
    const safeReturnUrl = getSafeReturnUrl(returnUrl)

    // Se non c'è URL valido, ritorna null (client farà redirect normale)
    if (!safeReturnUrl) {
      return res.status(200).json({
        ok: true,
        redirectUrl: null,
        message: 'Nessun URL di return valido, usa redirect interno',
      })
    }

    // Genera token firmato
    const now = Math.floor(Date.now() / 1000)
    const exp = now + 600 // 10 minuti

    const payload = {
      sub: affiliation.memberNumber || affiliation.id, // Preferisci memberNumber, altrimenti id (mai email)
      src: source || 'enotempo',
      iat: now,
      exp: exp,
    }

    const token = createHandoffToken(payload)

    // Costruisci URL di redirect con token
    const redirectUrl = new URL(safeReturnUrl)
    redirectUrl.searchParams.set('status', 'success')
    redirectUrl.searchParams.set('token', token)

    return res.status(200).json({
      ok: true,
      redirectUrl: redirectUrl.toString(),
    })
  } catch (error) {
    // Log solo eventId/affiliationId, non dati sensibili
    console.error('❌ [Handoff] Errore generazione token:', {
      orderID: orderIDForLog ? 'presente' : 'mancante',
      error: error.message,
    })
    return res.status(500).json({
      error: 'Errore generazione token handoff',
    })
  }
}
