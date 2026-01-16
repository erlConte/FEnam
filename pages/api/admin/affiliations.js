// pages/api/admin/affiliations.js
// API read-only per dashboard admin affiliazioni
import { prisma } from '../../../lib/prisma'
import { z } from 'zod'

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

/**
 * Estrae token da Authorization header o query param
 */
function getToken(req) {
  // Prova Authorization header
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Fallback su query param
  return req.query.token || null
}

/**
 * Verifica token admin
 */
function verifyAdminToken(token) {
  const adminToken = process.env.ADMIN_TOKEN
  if (!adminToken) {
    console.error('❌ [Admin API] ADMIN_TOKEN non configurato')
    return false
  }
  return token === adminToken
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 1) Autenticazione via token
  const token = getToken(req)
  if (!token || !verifyAdminToken(token)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token non valido' })
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

    return res.status(200).json({
      items,
      total,
      take,
      skip,
    })
  } catch (error) {
    console.error('❌ [Admin API] Errore:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
