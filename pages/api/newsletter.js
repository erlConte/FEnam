import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email } = req.body
  if (!email || !email.includes('@'))
    return res.status(400).json({ error: 'Email non valida' })

  try {
    // salva in lista e manda mail di benvenuto
    await resend.contacts.create({
      audienceId: process.env.RESEND_AUDIENCE_ID,
      email,
    })
    await resend.emails.send({
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: 'Benvenuto nella newsletter di FENAM',
      html: `<h2>Grazie per esserti iscritto!</h2><p>Riceverai aggiornamenti su eventi e progetti.</p>`,
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Errore server' })
  }
}
