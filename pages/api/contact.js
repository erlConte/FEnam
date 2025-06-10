// pages/api/contact.js
import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const { nome, cognome, telefono, email, messaggio } = req.body

  if (!nome || !cognome || !email || !messaggio) {
    return res.status(400).json({ error: 'Campi mancanti' })
  }

  // Se hai definito SMTP_HOST in env, lo usi, altrimenti crei un test account
  const transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: +process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : await (async () => {
        const testAcc = await nodemailer.createTestAccount()
        return nodemailer.createTransport({
          host: testAcc.smtp.host,
          port: testAcc.smtp.port,
          secure: testAcc.smtp.secure,
          auth: {
            user: testAcc.user,
            pass: testAcc.pass,
          },
        })
      })()

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER || `"Test" <${(await transporter).options.auth.user}>`,
      to: process.env.CONTACT_EMAIL || 'test@ethereal.email',
      subject: `Richiesta da ${nome} ${cognome}`,
      text: `
Nome: ${nome}
Cognome: ${cognome}
Telefono: ${telefono}
Email: ${email}

${messaggio}
      `,
    })

    // Se stai usando Ethereal, ottieni l’URL di preview e lo mandi in risposta
    if (!process.env.SMTP_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info)
      console.log('Preview URL: ', previewUrl)
      return res.status(200).json({ ok: true, previewUrl })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Errore interno' })
  }
}
