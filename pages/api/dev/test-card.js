// pages/api/dev/test-card.js
// Endpoint di test per generare PDF tessera (solo in development)

import { generateMembershipCardPdf } from '../../../lib/membershipCardPdf'

export default async function handler(req, res) {
  // Solo in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ error: 'Not found' })
  }

  // Protezione aggiuntiva: richiedi header segreto se configurato
  const devKey = process.env.DEV_ONLY_KEY
  if (devKey) {
    const providedKey = req.headers['x-dev-key']
    if (!providedKey || providedKey !== devKey) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  // Supporta GET e HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' })
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
    console.error('❌ [Test Card] Errore generazione PDF:', error)
    return res.status(500).json({
      error: 'Errore generazione PDF',
      message: error.message,
    })
  }
}
