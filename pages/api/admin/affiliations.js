// pages/api/admin/affiliations.js
// API read-only per dashboard admin affiliazioni
import { prisma } from '../../../lib/prisma'
import { z } from 'zod'
import { checkMethod, requireAdminAuth, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger } from '../../../lib/logger'

// Schema validazione query params
const querySchema = z.object({
  status: z.enum(['pending', 'completed']).optional(),
  membershipFilter: z.enum(['active', 'expired']).optional(), // Nuovo filtro membership
  q: z.string().optional(),
  take: z
    .string()
    .optional()
    .transform((val) => {
      const num = val ? parseInt(val, 10) : 50
      return Math.min(Math.max(num, 1), 200) // min 1, max 200
    })
    .pipe(z.number().min(1).max(200)),
  skip: z
    .string()
    .optional()
    .transform((val) => {
      const num = val ? parseInt(val, 10) : 0
      return Math.max(num, 0) // min 0
    })
    .pipe(z.number().min(0)),
})

export default async function handler(req, res) {
  // Gestione CORS
  if (handleCors(req, res)) {
    return
  }

  // Verifica metodo HTTP
  if (!checkMethod(req, res, ['GET'])) {
    return
  }

  // Autenticazione admin (solo header Authorization, non query string)
  if (!requireAdminAuth(req, res)) {
    return
  }

  try {
    // 2) Validazione query params
    const parseResult = querySchema.safeParse(req.query)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parseResult.error.errors,
      })
    }

    const { status, membershipFilter, q, take, skip } = parseResult.data

    // 3) Costruisci where clause per Prisma
    const where = {}

    // Filtro status
    if (status) {
      where.status = status
    }

    // Filtro membership (attivi/scaduti)
    if (membershipFilter) {
      const now = new Date()
      if (membershipFilter === 'active') {
        // Solo attivi: status completed E memberUntil > now
        where.status = 'completed'
        where.memberUntil = { gt: now }
      } else if (membershipFilter === 'expired') {
        // Solo scaduti: status completed E (memberUntil <= now O memberUntil null)
        where.status = 'completed'
        where.OR = [
          { memberUntil: { lte: now } },
          { memberUntil: null },
        ]
      }
    }

    // Filtro search (q) su email, nome, cognome, orderId
    if (q && q.trim()) {
      const searchTerm = q.trim()
      const searchOR = [
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { nome: { contains: searchTerm, mode: 'insensitive' } },
        { cognome: { contains: searchTerm, mode: 'insensitive' } },
        { orderId: { contains: searchTerm, mode: 'insensitive' } },
      ]

      // Se c'è già un OR per membershipFilter='expired', combiniamo con AND
      if (where.OR && membershipFilter === 'expired') {
        const existingOR = where.OR
        delete where.OR
        where.AND = [
          { OR: existingOR },
          { OR: searchOR },
        ]
      } else {
        // Altrimenti, aggiungiamo direttamente OR (se non c'è già un OR)
        if (where.OR) {
          // Se c'è già un OR, combiniamo con AND
          const existingOR = where.OR
          delete where.OR
          where.AND = [
            { OR: existingOR },
            { OR: searchOR },
          ]
        } else {
          where.OR = searchOR
        }
      }
    }

    // 4) Conta totale record (per paginazione)
    const total = await prisma.affiliation.count({ where })

    // 5) Fetch record con paginazione
    const items = await prisma.affiliation.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        telefono: true,
        orderId: true,
        status: true,
        payerEmail: true,
        confirmationEmailSentAt: true,
        memberSince: true,
        memberUntil: true,
        memberNumber: true,
        membershipCardSentAt: true,
        createdAt: true,
      },
    })

    return sendSuccess(res, {
      items,
      total,
      take,
      skip,
    })
  } catch (error) {
    logger.error('[Admin API] Errore', error)
    return sendError(res, 500, 'Internal server error', 'Errore durante il recupero delle affiliazioni')
  }
}
