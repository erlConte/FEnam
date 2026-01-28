// pages/api/admin/resend-card.js
// API admin per reinviare tessera PDF (protetta, rate limited, audit log)

import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { Resend } from 'resend'
import { generateMembershipCardPdf } from '../../../lib/membershipCardPdf'
import { rateLimit } from '../../../lib/rateLimit'
import { checkMethod, requireAdminAuth, sendError, sendSuccess } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger } from '../../../lib/logger'

// Inizializza Resend (opzionale, non blocca se manca)
let resend = null
const senderEmail = process.env.SENDER_EMAIL || 'noreply@fenam.website'
if (process.env.RESEND_API_KEY && senderEmail) {
  resend = new Resend(process.env.RESEND_API_KEY)
} else if (!process.env.SENDER_EMAIL) {
  logger.warn('[Resend Card] SENDER_EMAIL non configurato, usando fallback noreply@fenam.website')
}

// Schema validazione
const resendCardSchema = z.object({
  id: z.string().min(1, 'ID obbligatorio'),
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

  // Autenticazione admin (solo header Authorization, non query string)
  if (!requireAdminAuth(req, res)) {
    return
  }

  // 2) Rate limiting (5 richieste/minuto per admin)
  const allowed = await rateLimit(req, res, { maxRequests: 5, windowMs: 60 * 1000 })
  if (!allowed) {
    return // rateLimit ha già inviato la risposta 429
  }

  // 3) Validazione input
  const parseResult = resendCardSchema.safeParse({
    id: req.query.id,
  })

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid parameters',
      details: parseResult.error.errors,
    })
  }

  const { id } = parseResult.data

  try {
    // 4) Trova affiliation
    const affiliation = await prisma.affiliation.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        memberNumber: true,
        memberSince: true,
        memberUntil: true,
        status: true,
      },
    })

    if (!affiliation) {
      return res.status(404).json({ error: 'Affiliazione non trovata' })
    }

    if (affiliation.status !== 'completed') {
      return res.status(400).json({
        error: 'Affiliazione non completata',
        message: 'La tessera può essere inviata solo per affiliazioni completate',
      })
    }

    if (!affiliation.memberNumber) {
      return res.status(400).json({
        error: 'Numero tessera mancante',
        message: 'L\'affiliazione non ha un numero tessera assegnato',
      })
    }

    // 5) Verifica Resend configurato
    if (!resend) {
      return res.status(503).json({
        error: 'Servizio email non disponibile',
        message: 'RESEND_API_KEY o SENDER_EMAIL non configurati',
      })
    }

    // 6) Genera PDF tessera
    const pdfBuffer = await generateMembershipCardPdf({
      nome: affiliation.nome,
      cognome: affiliation.cognome,
      memberNumber: affiliation.memberNumber,
      memberSince: affiliation.memberSince,
      memberUntil: affiliation.memberUntil,
      id: affiliation.id,
    })

    // 7) Converti buffer a base64 per Resend
    const pdfBase64 = pdfBuffer.toString('base64')

    // 8) Invia email con PDF allegato
    await resend.emails.send({
      from: senderEmail,
      to: affiliation.email,
      subject: 'Reinvio tessera socio FENAM',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #8fd1d2; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background-color: #fff; padding: 15px; border-left: 4px solid #8fd1d2; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #fff; margin: 0;">FENAM</h1>
      <p style="color: #fff; margin: 5px 0 0 0;">Federazione Nazionale Associazioni Multiculturali</p>
    </div>
    <div class="content">
      <h2>Reinvio tessera socio</h2>
      <p>Caro/a <strong>${affiliation.nome} ${affiliation.cognome}</strong>,</p>
      <p>Come richiesto, ti reinviamo la tua tessera socio FENAM in formato PDF.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">Dettagli tessera</h3>
        <p><strong>Numero tessera:</strong> ${affiliation.memberNumber}</p>
        ${affiliation.memberSince ? `<p><strong>Valida dal:</strong> ${new Date(affiliation.memberSince).toLocaleDateString('it-IT')}</p>` : ''}
        ${affiliation.memberUntil ? `<p><strong>Valida fino al:</strong> ${new Date(affiliation.memberUntil).toLocaleDateString('it-IT')}</p>` : ''}
      </div>

      <p>Puoi stampare la tessera o conservarla sul tuo dispositivo. La tessera include un QR code per la verifica online.</p>
      
      <p>Per qualsiasi domanda o informazione:</p>
      <ul>
        <li>Email: <a href="mailto:${process.env.CONTACT_EMAIL || 'info@fenam.website'}">${process.env.CONTACT_EMAIL || 'info@fenam.website'}</a></li>
        <li>Visita il nostro sito: <a href="${process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'}">${process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'}</a></li>
      </ul>

      <p>Cordiali saluti,<br><strong>Il team FENAM</strong></p>
    </div>
    <div class="footer">
      <p>FENAM - Federazione Nazionale Associazioni Multiculturali</p>
      <p>Questa email è stata inviata automaticamente. Si prega di non rispondere.</p>
    </div>
  </div>
</body>
</html>
      `,
      text: `
FENAM - Federazione Nazionale Associazioni Multiculturali

Reinvio tessera socio

Caro/a ${affiliation.nome} ${affiliation.cognome},

Come richiesto, ti reinviamo la tua tessera socio FENAM in formato PDF.

DETTAGLI TESSERA:
- Numero tessera: ${affiliation.memberNumber}
${affiliation.memberSince ? `- Valida dal: ${new Date(affiliation.memberSince).toLocaleDateString('it-IT')}` : ''}
${affiliation.memberUntil ? `- Valida fino al: ${new Date(affiliation.memberUntil).toLocaleDateString('it-IT')}` : ''}

Puoi stampare la tessera o conservarla sul tuo dispositivo. La tessera include un QR code per la verifica online.

Per qualsiasi domanda o informazione:
- Email: ${process.env.CONTACT_EMAIL || 'info@fenam.website'}
- Sito web: ${process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'}

Cordiali saluti,
Il team FENAM

---
FENAM - Federazione Nazionale Associazioni Multiculturali
Questa email è stata inviata automaticamente. Si prega di non rispondere.
      `.trim(),
      attachments: [
        {
          filename: `Tessera_FENAM_${affiliation.memberNumber}.pdf`,
          content: pdfBase64,
          contentType: 'application/pdf',
        },
      ],
    })

    // 9) Aggiorna membershipCardSentAt (audit log)
    await prisma.affiliation.update({
      where: { id },
      data: { membershipCardSentAt: new Date() },
    })

    // 10) Audit log
    logger.info(
      `[Admin Resend Card] Tessera reinviata per affiliation ${id} (${affiliation.memberNumber})`
    )

    return sendSuccess(res, {
      ok: true,
      message: 'Tessera reinviata con successo',
      memberNumber: affiliation.memberNumber,
    })
  } catch (error) {
    logger.error('[Admin Resend Card] Errore', error)
    return sendError(res, 500, 'Internal server error', 'Errore durante il reinvio della tessera')
  }
}
