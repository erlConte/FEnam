import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'

const prisma = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)

const confirmSchema = z.object({
  token: z.string(),
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
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