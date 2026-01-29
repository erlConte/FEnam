// pages/api/admin/debug/affiliation.js
// Endpoint debug: ritorna stato record Affiliation per orderId (email mascherata)
import { prisma } from '../../../../lib/prisma'
import { checkMethod, requireAdminAuth, sendError, sendSuccess } from '../../../../lib/apiHelpers'
import { handleCors } from '../../../../lib/cors'
import { maskEmail } from '../../../../lib/logger'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (!checkMethod(req, res, ['GET'])) return
  if (!requireAdminAuth(req, res)) return

  const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : null
  if (!orderId) {
    return sendError(res, 400, 'Validation error', 'Query orderId obbligatorio')
  }

  try {
    const row = await prisma.affiliation.findUnique({
      where: { orderId },
      select: {
        id: true,
        orderId: true,
        status: true,
        memberNumber: true,
        memberSince: true,
        memberUntil: true,
        confirmationEmailSentAt: true,
        membershipCardSentAt: true,
        createdAt: true,
        email: true,
      },
    })

    if (!row) {
      return sendSuccess(res, { found: false, orderId })
    }

    return sendSuccess(res, {
      found: true,
      orderId: row.orderId,
      status: row.status,
      memberNumber: row.memberNumber,
      memberSince: row.memberSince?.toISOString() ?? null,
      memberUntil: row.memberUntil?.toISOString() ?? null,
      confirmationEmailSentAt: row.confirmationEmailSentAt?.toISOString() ?? null,
      membershipCardSentAt: row.membershipCardSentAt?.toISOString() ?? null,
      createdAt: row.createdAt?.toISOString() ?? null,
      email: maskEmail(row.email),
    })
  } catch (err) {
    return sendError(res, 500, 'Internal error', err.message)
  }
}
