// pages/api/newsletter.js
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'
import crypto from 'crypto'

const prisma = new PrismaClient()
const resend = new Resend(process.env.RESEND_API_KEY)

// Schema di validazione per email + consenso
const subscribeSchema = z.object({
  email:   z.string().email('Email non valida'),
  consent: z.boolean().refine(v => v, { message: 'Consenso obbligatorio' }),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo non consentito' })
  }

  // 1) Validazione input
  const parseResult = subscribeSchema.safeParse(req.body)
  if (!parseResult.success) {
    const msg = parseResult.error.issues[0].message
    return res.status(400).json({ ok: false, error: msg })
  }
  const { email } = parseResult.data

  // 2) Generazione token e scadenza (24h)
  const token     = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  try {
    // 3) Salvo richiesta in database
    await prisma.newsletterSubscription.create({
      data: { email, token, expiresAt },
    })

    // 4) Costruisco link di conferma
    const baseUrl     = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const confirmUrl  = `${baseUrl}/newsletter/confirm?token=${token}`

    // 5) Invio email di conferma
    await resend.emails.send({
      from:    process.env.SENDER_EMAIL,
      to:      email,
      subject: 'Conferma la tua iscrizione alla newsletter F.E.N.A.M.',
      html: `
        <p>Ciao!</p>
        <p>Grazie per esserti iscritto alla nostra newsletter.</p>
        <p>Per completare l’iscrizione, clicca qui 👉 <a href="${confirmUrl}">Conferma la tua email</a></p>
        <p>Il link scade in 24 ore.</p>
      `,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('❌ [newsletter] errore:', err)
    return res.status(500).json({ ok: false, error: 'Errore interno al server' })
  }
}

