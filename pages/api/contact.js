// pages/api/contact.js
import { z } from 'zod'
import { Resend } from 'resend'
import { rateLimit } from '../../lib/rateLimit'
import { checkMethod, sendError, sendSuccess } from '../../lib/apiHelpers'
import { handleCors } from '../../lib/cors'
import { logger, maskEmail } from '../../lib/logger'

// Inizializza Resend opzionalmente (non blocca startup se manca)
let resend = null
if (process.env.RESEND_API_KEY && process.env.SENDER_EMAIL) {
  resend = new Resend(process.env.RESEND_API_KEY)
}

// Schema di validazione
const contactSchema = z.object({
  nome:      z.string().min(1, 'Nome obbligatorio'),
  cognome:   z.string().min(1, 'Cognome obbligatorio'),
  telefono:  z.string().min(5, 'Telefono non valido').optional(),
  email:     z.string().email('Email non valida'),
  messaggio: z.string().min(10, 'Messaggio troppo corto'),
})

export default async function handler(req, res) {
  // Gestione CORS
  if (handleCors(req, res)) {
    return
  }

  // Verifica metodo HTTP
  if (!checkMethod(req, res, ['POST'])) {
    return
  }

  // Rate limiting: 10 richieste/minuto per IP
  const allowed = await rateLimit(req, res)
  if (!allowed) {
    return // rateLimit ha già inviato la risposta 429
  }

  // Validazione server-side
  const parse = contactSchema.safeParse(req.body)
  if (!parse.success) {
    return sendError(res, 400, 'Validation error', parse.error.issues[0].message)
  }
  const { nome, cognome, telefono, email, messaggio } = parse.data

  // Verifica Resend configurato
  if (!resend) {
    logger.error('[Contact API] RESEND_API_KEY o SENDER_EMAIL non configurati')
    return sendError(res, 503, 'Service unavailable', 'Servizio contatti momentaneamente non disponibile. Riprova più tardi.')
  }

  // Verifica CONTACT_EMAIL configurato
  const contactEmail = process.env.CONTACT_EMAIL || 'info@fenam.website'
  if (!contactEmail) {
    logger.error('[Contact API] CONTACT_EMAIL non configurato')
    return sendError(res, 503, 'Service unavailable', 'Servizio contatti momentaneamente non disponibile. Riprova più tardi.')
  }

  try {
    // Invio email tramite Resend (senza DB)
    await resend.emails.send({
      from:    process.env.SENDER_EMAIL,
      to:      contactEmail,
      replyTo: email,
      subject: `Richiesta da ${nome} ${cognome}`,
      html: `
        <h2>Nuova richiesta di contatto</h2>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Cognome:</strong> ${cognome}</p>
        <p><strong>Telefono:</strong> ${telefono || '-'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <hr/>
        <p><strong>Messaggio:</strong></p>
        <p>${messaggio.replace(/\n/g, '<br/>')}</p>
      `,
      text: `
Nuova richiesta di contatto

Nome: ${nome}
Cognome: ${cognome}
Telefono: ${telefono || '-'}
Email: ${email}

Messaggio:
${messaggio}
      `,
    })

    logger.info('[Contact API] Email inviata', { from: maskEmail(email), to: maskEmail(contactEmail) })

    return sendSuccess(res, { ok: true })
  } catch (err) {
    logger.error('[Contact API] Errore invio email Resend', err, { from: maskEmail(email) })
    return sendError(res, 500, 'Internal server error', 'Errore durante l\'invio del messaggio. Riprova più tardi.')
  }
}
