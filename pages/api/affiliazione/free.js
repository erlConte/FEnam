// pages/api/affiliazione/free.js
// Endpoint disabilitato: affiliazione gratuita non più disponibile

export default async function handler(req, res) {
  // Endpoint disabilitato: affiliazione gratuita non più disponibile
  if (process.env.NODE_ENV === 'production') {
    return res.status(410).json({
      error: 'Gone',
      message: 'L\'affiliazione gratuita non è più disponibile. La donazione minima è €10.',
      details: 'Per procedere con l\'affiliazione, utilizza il flusso PayPal con una donazione minima di €10.'
    })
  }

  // In sviluppo, rispondi con 404 per evitare confusione
  return res.status(404).json({
    error: 'Not Found',
    message: 'L\'affiliazione gratuita non è più disponibile. La donazione minima è €10.'
  })
}
