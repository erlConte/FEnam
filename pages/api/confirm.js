import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { Resend } from 'resend'
import { rateLimit } from '../../lib/rateLimit'
import { logger } from '../../lib/logger'

// Inizializza Resend opzionalmente (non blocca startup se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

const confirmSchema = z.object({
  token: z.string(),
})

// Helper per generare pagina HTML user-friendly
function renderHtmlPage(title, message, isSuccess = false) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'
  const contactEmail = process.env.CONTACT_EMAIL || 'info@fenam.website'
  
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      color: #333;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 500px;
      width: 90%;
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
      color: ${isSuccess ? '#12A969' : '#d32f2f'};
    }
    p {
      margin: 0.5rem 0;
      color: #666;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 12px 24px;
      background-color: #8fd1d2;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: background-color 0.3s;
    }
    .button:hover {
      background-color: #7bb8b9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${isSuccess ? '✅' : '❌'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${baseUrl}/supporto" class="button">Vai alla pagina di supporto</a>
    <p style="margin-top: 1.5rem; font-size: 0.9rem; color: #999;">
      Per assistenza: <a href="mailto:${contactEmail}" style="color: #8fd1d2;">${contactEmail}</a>
    </p>
  </div>
</body>
</html>`
}

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
    logger.error('[Confirm] RESEND_API_KEY o SENDER_EMAIL non configurati')
    const html = renderHtmlPage(
      'Servizio non disponibile',
      'Il servizio newsletter non è momentaneamente disponibile. Riprova più tardi o contatta il supporto.',
      false
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(503).send(html)
  }

  // Verifica RESEND_AUDIENCE_ID (richiesto per contacts.create)
  if (!process.env.RESEND_AUDIENCE_ID) {
    logger.error('[Confirm] RESEND_AUDIENCE_ID non configurato')
    const html = renderHtmlPage(
      'Servizio non configurato',
      'Il servizio newsletter non è configurato correttamente. Contatta il supporto.',
      false
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(503).send(html)
  }

  const parse = confirmSchema.safeParse(req.query)
  if (!parse.success) {
    const html = renderHtmlPage(
      'Token non valido',
      'Il link di conferma non è valido. Controlla di aver cliccato sul link completo dall\'email.',
      false
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(400).send(html)
  }
  const { token } = parse.data

  let record
  try {
    record = await prisma.newsletterSubscription.findUnique({
      where: { token },
    })
  } catch (dbErr) {
    // Se il DB non è disponibile o la tabella non esiste, gestiamo gracefully
    logger.error('[Confirm] Errore accesso DB (probabilmente tabella non esistente)', dbErr)
    const html = renderHtmlPage(
      'Servizio non disponibile',
      'Il flusso di iscrizione newsletter è cambiato. Puoi iscriverti direttamente dalla pagina di supporto.',
      false
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(503).send(html)
  }

  if (!record) {
    const html = renderHtmlPage(
      'Token non trovato',
      'Il link di conferma non è valido o è scaduto. Richiedi una nuova iscrizione dalla pagina di supporto.',
      false
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(404).send(html)
  }
  
  if (record.expiresAt < new Date()) {
    const html = renderHtmlPage(
      'Link scaduto',
      'Il link di conferma è scaduto. Richiedi una nuova iscrizione dalla pagina di supporto.',
      false
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(400).send(html)
  }
  
  if (record.confirmed) {
    const html = renderHtmlPage(
      'Iscrizione già confermata',
      'La tua iscrizione alla newsletter è già stata confermata. Grazie per essere parte della nostra comunità!',
      true
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
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

    const senderEmail = process.env.SENDER_EMAIL || 'noreply@fenam.website'
    await resend.emails.send({
      from: senderEmail,
      to: record.email,
      subject: 'Iscrizione confermata alla newsletter F.E.N.A.M.',
      html: '<h1>Iscrizione confermata!</h1><p>Grazie, riceverai presto le nostre novità.</p>',
    })

    const html = renderHtmlPage(
      'Iscrizione confermata!',
      'Grazie per esserti iscritto alla newsletter F.E.N.A.M. Riceverai presto le nostre novità via email.',
      true
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(html)
  } catch (err) {
    logger.error('[Confirm] Errore durante la conferma', err)
    const html = renderHtmlPage(
      'Errore durante la conferma',
      'Si è verificato un errore durante la conferma dell\'iscrizione. Riprova più tardi o contatta il supporto.',
      false
    )
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(500).send(html)
  }
}