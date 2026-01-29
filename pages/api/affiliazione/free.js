// pages/api/affiliazione/free.js
// Affiliazione gratuita (donazione = 0). In produzione abilitabile con ALLOW_FREE_AFFILIATION=true.

import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'
import { markAffiliationCompleted, runAffiliationSideEffects } from '../../../lib/affiliation'
import { checkMethod, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger, getCorrelationId, maskEmail } from '../../../lib/logger'

const freeSchema = z.object({
  nome: z.string().trim().min(2, 'Nome troppo corto').max(80, 'Nome troppo lungo'),
  cognome: z.string().trim().min(2, 'Cognome troppo corto').max(80, 'Cognome troppo lungo'),
  email: z.string().email('Email non valida').transform((v) => v.trim().toLowerCase()),
  telefono: z.string().trim().min(6, 'Telefono troppo corto').max(25, 'Telefono troppo lungo'),
  privacy: z.boolean().refine((v) => v === true, { message: 'Consenso privacy obbligatorio' }),
  donazione: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === null || val === '') return 0
      const num = typeof val === 'string' ? parseFloat(val) : val
      return isNaN(num) ? 0 : num
    })
    .pipe(z.number().refine((v) => v === 0, { message: 'Questo endpoint accetta solo donazione = 0' })),
})

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (!checkMethod(req, res, ['POST'])) return

  const allowed = await rateLimit(req, res)
  if (!allowed) return

  // Guard produzione: solo se esplicitamente abilitato
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_FREE_AFFILIATION !== 'true') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Free affiliation disabled',
    })
  }

  const correlationId = getCorrelationId(req)
  logger.info('[Affiliazione Free] route hit', { correlationId, endpoint: 'free' })

  const parseResult = freeSchema.safeParse(req.body)
  if (!parseResult.success) {
    const first = parseResult.error.errors[0]
    return sendError(res, 400, first?.message || 'Validation error', null, parseResult.error.errors)
  }

  const { nome, cognome, email, telefono, privacy } = parseResult.data

  try {
    const affiliation = await prisma.affiliation.create({
      data: {
        nome,
        cognome,
        email,
        telefono,
        privacy,
        orderId: null,
        status: 'pending',
      },
    })

    const dbResult = await markAffiliationCompleted({
      affiliationId: affiliation.id,
      payerEmail: null,
      correlationId,
    })

    let sideEffectsResult = { emailSent: false, cardSent: false, warnings: [] }
    try {
      sideEffectsResult = await runAffiliationSideEffects({
        affiliationId: affiliation.id,
        orderId: null,
        amount: 0,
        currency: 'EUR',
        correlationId,
      })
    } catch (sideErr) {
      logger.warn('[Affiliazione Free] Side effects non bloccante', { correlationId, error: sideErr.message })
      sideEffectsResult.warnings = sideEffectsResult.warnings || []
      sideEffectsResult.warnings.push('Errore durante invio email/tessera')
    }

    logger.info('[Affiliazione Free] Completata', {
      correlationId,
      affiliationId: affiliation.id,
      memberNumber: dbResult.memberNumber,
      email: maskEmail(email),
    })

    const payload = {
      ok: true,
      correlationId,
      memberNumber: dbResult.memberNumber,
    }
    if (sideEffectsResult.warnings?.length) payload.warnings = sideEffectsResult.warnings

    return sendSuccess(res, payload)
  } catch (err) {
    logger.error('[Affiliazione Free] Errore', err, { correlationId, email: maskEmail(email) })
    return sendError(res, 500, 'Internal error', 'Errore durante l\'affiliazione gratuita.', { correlationId })
  }
}
