// pages/api/newsletter.js
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { Resend } from 'resend'
import crypto from 'crypto'
import { rateLimit } from '../../lib/rateLimit'

// Inizializza Resend opzionalmente (non blocca startup se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

// Schema di validazione per email + consenso
const subscribeSchema = z.object({
  email:   z.string().email('Email non valida'),
  consent: z.boolean().refine(v => v, { message: 'Consenso obbligatorio' }),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo non consentito' })
  }

  // Rate limiting: 10 richieste/minuto per IP
  const allowed = await rateLimit(req, res)
  if (!allowed) {
    return // rateLimit ha già inviato la risposta 429
  }

  // Verifica Resend configurato
  if (!resend) {
    console.error('❌ [Newsletter] RESEND_API_KEY o SENDER_EMAIL non configurati')
    return res.status(503).json({
      ok: false,
      error: 'Servizio email non disponibile. Contatta il supporto.',
    })
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    if (!baseUrl) {
      console.error('NEXT_PUBLIC_BASE_URL is missing')
      return res.status(500).json({ ok: false, error: 'Configurazione server errata' })
    }
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

