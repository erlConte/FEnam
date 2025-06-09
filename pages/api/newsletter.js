import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email || !email.includes('@'))
    return res.status(400).json({ error: 'Email non valida' })

  try {
    // 1) Salva il contatto nella lista
    await resend.contacts.create({
      audienceId: process.env.RESEND_AUDIENCE_ID,
      email,
      unsubscribed: false,
    })

    // 2) E-mail di benvenuto
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Benvenuto nella newsletter di FENAM',
      html: `
        <h2>Grazie per esserti iscritto!</h2>
        <p>Riceverai aggiornamenti su eventi, progetti e opportunità.</p>
      `,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Errore server' })
  }
}
