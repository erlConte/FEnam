import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { Resend } from 'resend'
import { rateLimit } from '../../lib/rateLimit'

// Inizializza Resend opzionalmente (non blocca startup se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

const confirmSchema = z.object({
  token: z.string(),
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  // Rate limiting: 10 richieste/minuto per IP
  const allowed = await rateLimit(req, res)
  if (!allowed) {
    return // rateLimit ha già inviato la risposta 429
  }

  // Verifica Resend configurato
  if (!resend) {
    console.error('❌ [Confirm] RESEND_API_KEY o SENDER_EMAIL non configurati')
    return res.status(503).json({
      ok: false,
      error: 'Servizio email non disponibile. Contatta il supporto.',
    })
  }

  // Verifica RESEND_AUDIENCE_ID (richiesto per contacts.create)
  if (!process.env.RESEND_AUDIENCE_ID) {
    console.error('❌ [Confirm] RESEND_AUDIENCE_ID non configurato')
    return res.status(503).json({
      ok: false,
      error: 'Servizio email non configurato correttamente. Contatta il supporto.',
    })
  }

  const parse = confirmSchema.safeParse(req.query)
  if (!parse.success) {
    return res.status(400).json({ ok: false, error: 'Token mancante o non valido' })
  }
  const { token } = parse.data

  const record = await prisma.newsletterSubscription.findUnique({
    where: { token },
  })
  if (!record) {
    return res.status(404).json({ ok: false, error: 'Token non trovato' })
  }
  if (record.expiresAt < new Date()) {
    return res.status(400).json({ ok: false, error: 'Token scaduto' })
  }
  if (record.confirmed) {
    return res.status(200).json({ ok: true, message: 'Iscrizione già confermata' })
  }

  try {
    await resend.contacts.create({
      audienceId: process.env.RESEND_AUDIENCE_ID,
      email: record.email,
    })

    await prisma.newsletterSubscription.update({
      where: { token },
      data: { confirmed: true },
    })

    await resend.emails.send({
      from:    process.env.SENDER_EMAIL,
      to:      record.email,
      subject: 'Iscrizione confermata alla newsletter F.E.N.A.M.',
      html:    '<h1>Iscrizione confermata!</h1><p>Grazie, riceverai presto le nostre novità.</p>',
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Newsletter confirmation error:', err)
    return res.status(500).json({ ok: false, error: 'Errore durante la conferma' })
  }
}