// pages/api/dev/test-card.js
// Endpoint di test per generare PDF tessera (solo in development)

import { generateMembershipCardPdf } from '../../../lib/membershipCardPdf'
import { requireDev, checkMethod, sendError } from '../../../lib/apiHelpers'
import { handleCors } from '../../../lib/cors'
import { logger } from '../../../lib/logger'

export default async function handler(req, res) {
  // Gestione CORS
  if (handleCors(req, res)) {
    return
  }

  // Verifica metodo HTTP
  if (!checkMethod(req, res, ['GET', 'HEAD'])) {
    return
  }

  // Protezione endpoint dev
  if (!requireDev(req, res)) {
    return
  }

  try {
    // Dati di test
    const testData = {
      nome: 'Mario',
      cognome: 'Rossi',
      memberNumber: 'FENAM-2026-TEST01',
      memberSince: new Date(),
      memberUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // +1 anno
    }

    // Genera PDF
    const pdfBuffer = await generateMembershipCardPdf(testData)

    // Ritorna PDF come download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Tessera_FENAM_${testData.memberNumber}.pdf"`
    )
    
    // Per HEAD, invia solo gli header senza body
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', pdfBuffer.length)
      return res.status(200).end()
    }
    
    res.send(pdfBuffer)
  } catch (error) {
    logger.error('[Test Card] Errore generazione PDF', error)
    return sendError(res, 500, 'Errore generazione PDF', error.message)
  }
}
