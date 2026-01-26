// lib/handoffToken.js
// Genera token firmato HMAC per handoff FeNAM -> Enotempo

import crypto from 'crypto'

/**
 * Serializza un oggetto JSON in modo deterministico (chiavi ordinate)
 * Garantisce che lo stesso oggetto produca sempre la stessa stringa
 * 
 * @param {Object} obj - Oggetto da serializzare
 * @returns {string} JSON string con chiavi ordinate
 */
function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stableStringify(item)).join(',') + ']'
  }

  // Ordina le chiavi per garantire output deterministico
  const keys = Object.keys(obj).sort()
  const pairs = keys.map(key => {
    const value = obj[key]
    return JSON.stringify(key) + ':' + stableStringify(value)
  })
  return '{' + pairs.join(',') + '}'
}

/**
 * Crea un token firmato HMAC SHA256 per handoff
 * Formato: base64url(payloadJSON) + "." + base64url(hmacSHA256(payloadB64, SECRET))
 * 
 * @param {Object} payload - Payload da firmare
 * @param {string} [secret] - Secret per firma (default: FENAM_HANDOFF_SECRET da env)
 * @returns {string} Token firmato
 */
export function createHandoffToken(payload, secret = null) {
  const secretToUse = secret || process.env.FENAM_HANDOFF_SECRET

  if (!secretToUse) {
    throw new Error('FENAM_HANDOFF_SECRET non configurato')
  }

  // Crea copia del payload e aggiungi jti (nonce) se non presente per replay protection
  // Evita di mutare l'oggetto payload originale
  const p = {
    ...payload,
    jti: payload.jti ?? payload.nonce ?? crypto.randomBytes(16).toString('hex'),
  }

  // Serializza payload a JSON in modo deterministico (chiavi ordinate) e codifica in base64url
  const payloadJson = stableStringify(p)
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, 'utf8'))

  // Calcola HMAC SHA256
  const hmac = crypto.createHmac('sha256', secretToUse)
  hmac.update(payloadB64)
  const signature = base64UrlEncode(hmac.digest())

  // Token formato: payload.signature
  return `${payloadB64}.${signature}`
}

/**
 * Verifica e decodifica un token firmato
 * 
 * @param {string} token - Token da verificare
 * @param {string} [secret] - Secret per verifica (default: FENAM_HANDOFF_SECRET da env)
 * @returns {Object|null} Payload decodificato se valido, null altrimenti
 */
export function verifyHandoffToken(token, secret = null) {
  const secretToUse = secret || process.env.FENAM_HANDOFF_SECRET

  if (!secretToUse) {
    throw new Error('FENAM_HANDOFF_SECRET non configurato')
  }

  try {
    const [payloadB64, signature] = token.split('.')

    if (!payloadB64 || !signature) {
      return null
    }

    // Verifica HMAC con confronto constant-time per sicurezza
    const hmac = crypto.createHmac('sha256', secretToUse)
    hmac.update(payloadB64)
    const expectedSignature = base64UrlEncode(hmac.digest())

    // Confronto constant-time per prevenire timing attacks
    // Converti entrambe le signature da base64url a buffer per confronto sicuro
    try {
      const signatureBuffer = base64UrlDecode(signature)
      const expectedBuffer = base64UrlDecode(expectedSignature)
      
      // Se le lunghezze differiscono, il token è invalido
      if (signatureBuffer.length !== expectedBuffer.length) {
        return null
      }
      
      if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null
      }
    } catch (decodeError) {
      // Errore decodifica: token malformato
      return null
    }

    // Decodifica payload
    const payloadJson = base64UrlDecode(payloadB64).toString('utf8')
    const payload = JSON.parse(payloadJson)

    // Verifica scadenza
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null // Token scaduto
    }

    return payload
  } catch (error) {
    console.error('Errore verifica token:', error)
    return null
  }
}

/**
 * Codifica buffer in base64url (senza padding, con sostituzione caratteri)
 */
function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Decodifica base64url a buffer
 */
function base64UrlDecode(str) {
  // Aggiungi padding se necessario
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64')
}
