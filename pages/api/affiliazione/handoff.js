// pages/api/affiliazione/handoff.js
// GET ?redirect=... — già socio: sessione da cookie, 302 verso redirect con fenamToken.
// POST body { orderID, returnUrl?, source? } — post-pagamento: ritorna JSON con redirectUrl (fenamToken in query).

import { createHandoffToken } from '../../../lib/handoffToken'
import { getSafeReturnUrl } from '../../../lib/validateReturnUrl'
import { prisma } from '../../../lib/prisma'
import { COOKIE_NAME, verifyMemberSessionToken } from '../../../lib/memberSession'
import { z } from 'zod'

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`))
  if (!match) return null
  try {
    return decodeURIComponent(match[1].trim())
  } catch {
    return match[1].trim()
  }
}

const handoffSchema = z.object({
  orderID: z.string().min(1, 'OrderID obbligatorio'),
  returnUrl: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
})

async function handleGet(req, res) {
  if (!process.env.FENAM_HANDOFF_SECRET || process.env.FENAM_HANDOFF_SECRET.trim() === '') {
    return res.status(503).send('Service unavailable')
  }
  const redirectRaw = typeof req.query.redirect === 'string' ? req.query.redirect.trim() : ''
  if (!redirectRaw) {
    return res.redirect(302, '/affiliazione')
  }
  const safeRedirect = getSafeReturnUrl(redirectRaw)
  if (!safeRedirect) {
    return res.redirect(302, '/affiliazione')
  }
  const cookieHeader = req.headers.cookie ?? null
  const sessionToken = getCookieValue(cookieHeader, COOKIE_NAME)
  const session = sessionToken ? verifyMemberSessionToken(sessionToken) : null
  if (!session?.affiliationId) {
    return res.redirect(302, '/accedi-socio?source=enotempo&returnUrl=' + encodeURIComponent(redirectRaw))
  }
  const affiliation = await prisma.affiliation.findUnique({
    where: { id: session.affiliationId },
    select: { id: true, memberNumber: true, status: true, memberUntil: true },
  })
  if (!affiliation || affiliation.status !== 'completed' || !affiliation.memberUntil) {
    return res.redirect(302, '/affiliazione')
  }
  const untilDate = new Date(affiliation.memberUntil)
  if (Number.isNaN(untilDate.getTime()) || untilDate <= new Date()) {
    return res.redirect(302, '/affiliazione')
  }
  const now = Math.floor(Date.now() / 1000)
  const exp = now + 600
  const payload = {
    sub: affiliation.memberNumber || affiliation.id,
    src: 'enotempo',
    iat: now,
    exp,
  }
  const handoffToken = createHandoffToken(payload)
  const u = new URL(safeRedirect)
  u.searchParams.set('fenamToken', handoffToken)
  return res.redirect(302, u.toString())
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res)
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
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

    // Verifica che l'affiliazione esista e sia completata + valida (non scaduta)
    const affiliation = await prisma.affiliation.findUnique({
      where: { orderId: orderID },
      select: {
        id: true,
        memberNumber: true,
        status: true,
        memberUntil: true,
      },
    })

    if (!affiliation) {
      return res.status(404).json({ error: 'Affiliazione non trovata' })
    }

    if (affiliation.status !== 'completed') {
      return res.status(400).json({
        error: 'Affiliazione non completata',
        details: "L'affiliazione deve essere completata per generare il token di handoff",
      })
    }

    // ✅ Check validità tessera: memberUntil presente e nel futuro
    if (!affiliation.memberUntil) {
      return res.status(403).json({
        error: 'Affiliazione non valida',
        details: 'La tessera non risulta attiva (manca la data di scadenza).',
      })
    }

    const untilDate = new Date(affiliation.memberUntil)
    if (Number.isNaN(untilDate.getTime())) {
      return res.status(500).json({
        error: 'Affiliazione non valida',
        details: 'Formato data scadenza non valido.',
      })
    }

    const nowDate = new Date()
    if (untilDate <= nowDate) {
      return res.status(403).json({
        error: 'Affiliazione scaduta',
        details: 'La tessera è scaduta: rinnova per proseguire.',
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

    const handoffToken = createHandoffToken(payload)
    const u = new URL(safeReturnUrl)
    u.searchParams.set('status', 'success')
    u.searchParams.set('fenamToken', handoffToken)

    return res.status(200).json({
      ok: true,
      redirectUrl: u.toString(),
    })
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Handoff] Errore', { hasOrderID: !!orderIDForLog, err: error?.message || 'unknown' })
    }
    return res.status(500).json({
      error: 'Errore generazione token handoff',
    })
  }
}
