// pages/api/affiliazione/free.js
// Endpoint per affiliazione gratuita (donazione = 0)

import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'
import { completeAffiliation } from '../../../lib/affiliation'
import { randomBytes } from 'crypto'

// Schema di validazione Zod
const freeAffiliationSchema = z.object({
  nome: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, { message: 'Nome troppo corto (min 2 caratteri)' })
    .refine((val) => val.length <= 80, { message: 'Nome troppo lungo (max 80 caratteri)' }),
  cognome: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 2, { message: 'Cognome troppo corto (min 2 caratteri)' })
    .refine((val) => val.length <= 80, { message: 'Cognome troppo lungo (max 80 caratteri)' }),
  email: z
    .string()
    .email('Email non valida')
    .transform((val) => val.trim().toLowerCase()),
  telefono: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 6, { message: 'Telefono troppo corto (min 6 caratteri)' })
    .refine((val) => val.length <= 25, { message: 'Telefono troppo lungo (max 25 caratteri)' }),
  privacy: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Consenso privacy obbligatorio',
    }),
  donazione: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return 0
      const num = typeof val === 'string' ? parseFloat(val) : val
      return isNaN(num) ? 0 : Math.max(0, num)
    })
    .pipe(z.number().min(0)),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting: 10 richieste/minuto per IP
  const allowed = await rateLimit(req, res)
  if (!allowed) {
    return // rateLimit ha già inviato la risposta 429
  }

  // 1) Validazione input con Zod
  const parseResult = freeAffiliationSchema.safeParse(req.body)
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0]
    return res.status(400).json({
      error: firstError.message || 'Validazione fallita',
      details: parseResult.error.errors,
    })
  }

  const { nome, cognome, email, telefono, privacy, donazione } = parseResult.data

  // 2) Verifica che donazione sia 0 o mancante
  if (donazione > 0) {
    return res.status(400).json({
      error: 'Per donazioni > 0 usa /api/affiliazione/paypal',
      details: [{ path: ['donazione'], message: 'Per donazioni > 0 usa /api/affiliazione/paypal' }],
    })
  }

  // 3) Idempotenza: cerca affiliazione esistente con stessa email (completed)
  const existingAffiliation = await prisma.affiliation.findFirst({
    where: {
      email: email.toLowerCase(),
      status: 'completed',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (existingAffiliation && existingAffiliation.orderId) {
    // Affiliazione già esistente: ritorna orderId esistente
    console.log(`ℹ️ [Free Affiliation] Affiliazione già esistente, ritorno orderId esistente`, {
      orderId: existingAffiliation.orderId,
    })
    return res.status(200).json({
      ok: true,
      orderID: existingAffiliation.orderId,
    })
  }

  // 4) Genera orderId univoco nel formato FREE-<random>
  const orderId = `FREE-${randomBytes(8).toString('hex')}`

  try {
    // 5) Crea record nel DB con status "pending" (completeAffiliation lo porterà a "completed")
    const affiliation = await prisma.affiliation.create({
      data: {
        nome,
        cognome,
        email,
        telefono,
        privacy,
        orderId,
        status: 'pending', // completeAffiliation lo porterà a "completed" dopo aver generato memberNumber e date
      },
    })

    // 6) Completa affiliazione: genera memberNumber, imposta date, invia email e PDF
    const completionResult = await completeAffiliation({
      affiliationId: affiliation.id,
      payerEmail: null, // Nessun PayPal per affiliazione gratuita
      amount: 0,
      currency: 'EUR',
    })

    console.log(`✅ [Free Affiliation] Affiliazione gratuita completata`, {
      orderId,
      memberNumber: completionResult.memberNumber,
      emailSent: completionResult.emailSent,
      cardSent: completionResult.cardSent,
    })

    return res.status(200).json({
      ok: true,
      orderID: orderId,
    })
  } catch (dbError) {
    console.error('❌ [Free Affiliation] Errore DB:', {
      orderId,
      error: dbError.message,
    })
    return res.status(500).json({
      error: 'Errore durante la creazione dell\'affiliazione',
    })
  }
}
