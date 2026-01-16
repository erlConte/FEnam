// pages/api/membership/verify.js
// API pubblica read-only per verificare lo stato di una membership tramite memberNumber

import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { rateLimit } from '../../../lib/rateLimit'

// Schema di validazione Zod
const verifySchema = z.object({
  memberNumber: z
    .union([z.string(), z.undefined()])
    .transform((val) => {
      // Gestisce undefined, array, o stringa
      if (val === undefined || val === null) return undefined
      if (Array.isArray(val)) return val[0] // Prende il primo se array
      return String(val).trim().toUpperCase()
    })
    .pipe(
      z
        .string()
        .min(1, 'memberNumber obbligatorio')
        .refine((val) => val.length > 0, { message: 'memberNumber non può essere vuoto' })
    ),
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Rate limiting: 10 richieste/minuto per IP
    const allowed = await rateLimit(req, res)
    if (!allowed) {
      return // rateLimit ha già inviato la risposta 429
    }

    // 1) Validazione input con Zod (safeParse)
    const parseResult = verifySchema.safeParse({
      memberNumber: req.query.memberNumber,
    })

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]
      const errorResponse = {
        error: 'Invalid memberNumber',
      }
      
      // Aggiungi details solo in development
      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = parseResult.error.errors
      }

      return res.status(400).json(errorResponse)
    }

    const { memberNumber } = parseResult.data

    // 2) Cerca Affiliation per memberNumber
    const affiliation = await prisma.affiliation.findUnique({
      where: { memberNumber },
      select: {
        status: true,
        memberSince: true,
        memberUntil: true,
        // Non selezioniamo PII (email, telefono, nome, cognome, ecc.)
      },
    })

    if (!affiliation) {
      // Tessera non trovata: 200 con found=false
      return res.status(200).json({
        found: false,
        status: null,
        active: false,
        memberUntil: null,
        memberSince: null,
      })
    }

    // 3) Calcola se la membership è attiva
    const now = new Date()
    let isActive = false
    try {
      isActive =
        affiliation.status === 'completed' &&
        affiliation.memberUntil &&
        new Date(affiliation.memberUntil) > now
    } catch (dateError) {
      // Se conversione data fallisce, isActive rimane false
      console.warn('[Verify] Errore conversione data memberUntil:', dateError)
    }

    // 4) Risposta con dati minimi (no PII)
    return res.status(200).json({
      found: true,
      status: affiliation.status,
      active: isActive,
      memberUntil: affiliation.memberUntil ? affiliation.memberUntil.toISOString() : null,
      memberSince: affiliation.memberSince ? affiliation.memberSince.toISOString() : null,
    })
  } catch (error) {
    // Log completo con stack trace
    console.error('[Verify] Errore interno:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      // Non loggiamo req.query per sicurezza (potrebbe contenere dati sensibili)
    })

    return res.status(500).json({
      error: 'Internal Server Error',
    })
  }
}

// Test manuali (PowerShell):
// 
// 1. Test input invalido (manca memberNumber):
//    curl.exe -X GET "http://localhost:3000/api/membership/verify"
//    # Atteso: 400 { "error": "Invalid memberNumber", "details": [...] }
//
// 2. Test tessera non trovata:
//    curl.exe -X GET "http://localhost:3000/api/membership/verify?memberNumber=FENAM-2026-NOTFOUND"
//    # Atteso: 200 { "found": false, "status": null, "active": false, "memberUntil": null, "memberSince": null }
//
// 3. Test tessera trovata (usa un memberNumber esistente dal DB):
//    curl.exe -X GET "http://localhost:3000/api/membership/verify?memberNumber=FENAM-2026-ABC123"
//    # Atteso: 200 { "found": true, "status": "completed", "active": true, "memberUntil": "...", "memberSince": "..." }
