// pages/api/contact.js
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import nodemailer from 'nodemailer'
import { rateLimit } from '../../lib/rateLimit'

// 1) Schema di validazione
const contactSchema = z.object({
  nome:      z.string().min(1, 'Nome obbligatorio'),
  cognome:   z.string().min(1, 'Cognome obbligatorio'),
  telefono:  z.string().min(5, 'Telefono non valido').optional(),
  email:     z.string().email('Email non valida'),
  messaggio: z.string().min(10, 'Messaggio troppo corto'),
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

  // 2) Validazione server-side
  const parse = contactSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ ok: false, error: parse.error.issues[0].message })
  }
  const { nome, cognome, telefono, email, messaggio } = parse.data

  try {
    // 3) Salvo SEMPRE in database
    await prisma.contactMessage.create({
      data: {
        nome,
        cognome,
        telefono: telefono || null,
        email,
        messaggio,
      },
    })
  } catch (dbErr) {
    console.error('❌ Errore DB contactMessage:', dbErr)
    return res.status(500).json({ ok: false, error: 'Errore salvataggio in database' })
  }

  // 4) Se hai le credenziali SMTP, invia la mail; altrimenti skip
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_PORT
  ) {
    try {
      const transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:  +process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })

      await transporter.sendMail({
        from:    `"${nome} ${cognome}" <${process.env.SMTP_USER}>`,
        to:      process.env.CONTACT_EMAIL,
        subject: `Richiesta da ${nome} ${cognome}`,
        text: `
Nome: ${nome}
Cognome: ${cognome}
Telefono: ${telefono || '-'}
Email: ${email}

${messaggio}
        `,
      })
    } catch (mailErr) {
      console.warn('⚠️ SMTP non configurato correttamente o errore invio mail:', mailErr)
      // non blocchiamo l'utente, andiamo avanti
    }
  } else {
    console.log('ℹ️ Credenziali SMTP non trovate, salto invio email.')
  }

  // 5) Risposta di successo
  return res.status(200).json({ ok: true })
}
