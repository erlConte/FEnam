// lib/membershipCardPdf.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

/**
 * Genera un PDF tessera socio personalizzato
 * @param {Object} params
 * @param {string} params.nome
 * @param {string} params.cognome
 * @param {string} params.memberNumber - Formato: FENAM-YYYY-XXXXXX
 * @param {Date|string} params.memberSince
 * @param {Date|string} params.memberUntil
 * @param {string} params.id - ID univoco interno (opzionale, default: memberNumber)
 * @returns {Promise<Buffer>} Buffer del PDF
 */
export async function generateMembershipCardPdf({
  nome,
  cognome,
  memberNumber,
  memberSince,
  memberUntil,
  id,
}) {
  // Crea nuovo documento PDF (formato card: 85.6mm x 54mm)
  // Conversione: 1mm = 2.83465 punti (72 DPI)
  const cardWidth = 85.6 * 2.83465 // ~243 punti
  const cardHeight = 54 * 2.83465 // ~153 punti
  
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([cardWidth, cardHeight])
  const { width, height } = page.getSize()

  // Carica font
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Colori brand (coerenti con il sito)
  // Primary: #12A969 (verde brillante dal tailwind.config.js)
  const primaryColor = rgb(0.07, 0.66, 0.41) // #12A969
  const darkColor = rgb(0.2, 0.2, 0.2) // #333
  const white = rgb(1, 1, 1)

  // Margini e spaziature (adattati per formato card, aumentati per stampa)
  const margin = 10 // Margini aumentati per stampa
  const headerHeight = 24
  const qrCodeSize = 35
  const footerHeight = 12
  const logoSize = 18 // Dimensione logo

  // Header con background colorato
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width: width,
    height: headerHeight,
    color: primaryColor,
  })

  // Carica logo se esiste (cerca in /public/img/logo*)
  let logoImage = null
  try {
    const publicPath = path.join(process.cwd(), 'public', 'img')
    const logoFiles = ['LOGO-FENAM-14.png', 'FENAM-ICON.png']
    for (const logoFile of logoFiles) {
      const logoPath = path.join(publicPath, logoFile)
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath)
        // Prova PNG prima, poi JPG
        try {
          logoImage = await pdfDoc.embedPng(logoBytes)
        } catch {
          try {
            logoImage = await pdfDoc.embedJpg(logoBytes)
          } catch {
            // Se fallisce, usa placeholder testo
          }
        }
        break
      }
    }
  } catch (logoError) {
    console.warn('⚠️ [PDF] Errore caricamento logo:', logoError)
  }

  // Logo o placeholder testo
  if (logoImage) {
    page.drawImage(logoImage, {
      x: margin,
      y: height - headerHeight + (headerHeight - logoSize) / 2,
      width: logoSize,
      height: logoSize,
    })
    // Titolo FENAM accanto al logo
    page.drawText('FENAM', {
      x: margin + logoSize + 5,
      y: height - 16,
      size: 12,
      font: helveticaBoldFont,
      color: white,
    })
  } else {
    // Placeholder testo se logo non disponibile
    page.drawText('FENAM', {
      x: margin,
      y: height - 16,
      size: 14,
      font: helveticaBoldFont,
      color: white,
    })
  }

  // Nome e Cognome (grande, subito sotto header)
  const fullName = `${nome.toUpperCase()} ${cognome.toUpperCase()}`
  const nameY = height - headerHeight - 20
  page.drawText(fullName, {
    x: margin,
    y: nameY,
    size: 16,
    font: helveticaBoldFont,
    color: darkColor,
    maxWidth: width - margin * 2 - qrCodeSize - 5, // Lascia spazio per QR code
  })

  // Numero tessera
  let currentY = nameY - 18
  if (memberNumber) {
    page.drawText('N. Tessera:', {
      x: margin,
      y: currentY,
      size: 7,
      font: helveticaFont,
      color: darkColor,
    })
    page.drawText(memberNumber, {
      x: margin + 45,
      y: currentY,
      size: 9,
      font: helveticaBoldFont,
      color: primaryColor,
    })
    currentY -= 12
  }

  // Date validità (formato compatto)
  const formatDate = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  if (memberSince && memberUntil) {
    // Mostra validità in formato compatto: "Dal DD/MM/YYYY al DD/MM/YYYY"
    const validitaText = `Dal ${formatDate(memberSince)} al ${formatDate(memberUntil)}`
    page.drawText(validitaText, {
      x: margin,
      y: currentY,
      size: 7,
      font: helveticaFont,
      color: darkColor,
      maxWidth: width - margin * 2 - qrCodeSize - 5,
    })
    currentY -= 10
  } else {
    if (memberSince) {
      page.drawText(`Dal: ${formatDate(memberSince)}`, {
        x: margin,
        y: currentY,
        size: 7,
        font: helveticaFont,
        color: darkColor,
      })
      currentY -= 10
    }
    if (memberUntil) {
      page.drawText(`Al: ${formatDate(memberUntil)}`, {
        x: margin,
        y: currentY,
        size: 7,
        font: helveticaFont,
        color: darkColor,
      })
      currentY -= 10
    }
  }

  // QR Code (se NEXT_PUBLIC_BASE_URL presente) - posizionato in basso a destra
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  const qrCodeX = width - margin - qrCodeSize
  const qrCodeY = footerHeight + 5

  if (baseUrl && memberNumber) {
    try {
      const verifyUrl = `${baseUrl}/verifica?memberNumber=${encodeURIComponent(memberNumber)}`
      // Genera QR code come PNG buffer (dimensione ridotta per card)
      const qrCodeBuffer = await QRCode.toBuffer(verifyUrl, {
        width: 150,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })

      // Embed immagine QR code
      const qrCodeImage = await pdfDoc.embedPng(qrCodeBuffer)

      page.drawImage(qrCodeImage, {
        x: qrCodeX,
        y: qrCodeY,
        width: qrCodeSize,
        height: qrCodeSize,
      })

      // Etichetta QR code (piccola, sotto il QR)
      page.drawText('Verifica', {
        x: qrCodeX + qrCodeSize / 2 - 15,
        y: qrCodeY - 6,
        size: 5,
        font: helveticaFont,
        color: darkColor,
      })
    } catch (qrError) {
      console.warn('⚠️ [PDF] Errore generazione QR code:', qrError)
      // Se manca baseUrl o errore, omettiamo QR code (non mostriamo placeholder)
    }
  }

  // ID univoco stampato (in basso a sinistra, piccolo)
  const uniqueId = id || memberNumber || 'N/A'
  page.drawText(`ID: ${uniqueId}`, {
    x: margin,
    y: footerHeight + 2,
    size: 5,
    font: helveticaFont,
    color: darkColor,
  })

  // Firma/Ruolo (in basso a destra, prima del QR se presente)
  const signatureText = 'Presidente FENAM'
  const signatureX = width - margin - (baseUrl && memberNumber ? qrCodeSize + 5 : 0) - 60
  page.drawText(signatureText, {
    x: signatureX,
    y: footerHeight + 2,
    size: 5,
    font: helveticaFont,
    color: darkColor,
  })

  // Footer piccolo con dominio (centrato in basso)
  const footerBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://fenam.website'
  const domain = footerBaseUrl.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const footerText = domain
  const footerTextWidth = helveticaFont.widthOfTextAtSize(footerText, 6)
  page.drawText(footerText, {
    x: (width - footerTextWidth) / 2,
    y: footerHeight - 2,
    size: 6,
    font: helveticaFont,
    color: darkColor,
  })

  // Serializza PDF a bytes
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
