// lib/logger.js
// Logger standardizzato per il progetto

import crypto from 'crypto'

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
}

const currentLogLevel =
  process.env.LOG_LEVEL === 'debug'
    ? LOG_LEVELS.DEBUG
    : process.env.NODE_ENV === 'development'
    ? LOG_LEVELS.INFO
    : LOG_LEVELS.WARN

/**
 * Logger standardizzato
 */
export const logger = {
  error: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(`❌ [${new Date().toISOString()}] ${message}`, ...args)
    }
  },

  warn: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(`⚠️  [${new Date().toISOString()}] ${message}`, ...args)
    }
  },

  info: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`ℹ️  [${new Date().toISOString()}] ${message}`, ...args)
    }
  },

  debug: (message, ...args) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log(`🔍 [${new Date().toISOString()}] ${message}`, ...args)
    }
  },
}

/**
 * Log error senza esporre dati sensibili
 * @param {string} context - Contesto dell'errore (es. "[PayPal API]")
 * @param {Error} error - Errore da loggare
 * @param {object} metadata - Metadata aggiuntivo (senza dati sensibili)
 */
export function logError(context, error, metadata = {}) {
  const safeMetadata = {
    ...metadata,
    message: error.message,
    name: error.name,
    // Non loggare stack trace in produzione
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  }
  logger.error(`${context} ${error.message}`, safeMetadata)
}

/**
 * Maschera email per privacy (es. "user@example.com" -> "use***@example.com")
 * @param {string} email - Email da mascherare
 * @returns {string} Email mascherata
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***'
  const [localPart, domain] = email.split('@')
  if (!domain) return email.substring(0, 3) + '***'
  const maskedLocal = localPart.length > 3 
    ? localPart.substring(0, 3) + '***'
    : localPart.substring(0, 1) + '***'
  return `${maskedLocal}@${domain}`
}

/**
 * Maschera telefono per privacy (es. "+39123456789" -> "+39***789")
 * @param {string} phone - Telefono da mascherare
 * @returns {string} Telefono mascherato
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '***'
  if (phone.length <= 6) return '***'
  return phone.substring(0, 3) + '***' + phone.substring(phone.length - 3)
}

/**
 * Maschera nome/cognome per privacy (es. "Mario Rossi" -> "M*** R***")
 * @param {string} name - Nome da mascherare
 * @returns {string} Nome mascherato
 */
export function maskName(name) {
  if (!name || typeof name !== 'string') return '***'
  if (name.length <= 2) return '***'
  return name.substring(0, 1) + '***'
}

/**
 * Estrae correlationId da header o genera uno nuovo
 * @param {import('next').NextApiRequest} req
 * @returns {string} Correlation ID
 */
export function getCorrelationId(req) {
  return req.headers['x-correlation-id'] || 
         process.env.VERCEL_REQUEST_ID || 
         crypto.randomBytes(8).toString('hex')
}

/**
 * Log error strutturato con categoria e metadata Vercel
 * @param {string} context - Contesto (es. "[PayPal API]")
 * @param {Error} error - Errore da loggare
 * @param {object} metadata - Metadata aggiuntivo (senza dati sensibili)
 * @param {string} category - Categoria errore (DB_CONN, PRISMA, VALIDATION, PAYPAL, AUTH, EMAIL, PDF, UNKNOWN)
 */
export function logErrorStructured(context, error, metadata = {}, category = 'UNKNOWN') {
  const requestId = process.env.VERCEL_REQUEST_ID || process.env.VERCEL_FUNCTION_INVOCATION_ID || 'local'
  
  // Maschera dati sensibili nei metadata
  const safeMetadata = { ...metadata }
  if (safeMetadata.email) safeMetadata.email = maskEmail(safeMetadata.email)
  if (safeMetadata.payerEmail) safeMetadata.payerEmail = maskEmail(safeMetadata.payerEmail)
  if (safeMetadata.telefono) safeMetadata.telefono = maskPhone(safeMetadata.telefono)
  if (safeMetadata.nome) safeMetadata.nome = maskName(safeMetadata.nome)
  if (safeMetadata.cognome) safeMetadata.cognome = maskName(safeMetadata.cognome)
  
  const logData = {
    category,
    errorName: error.name,
    errorCode: error.code || error.statusCode || null,
    message: error.message,
    requestId,
    ...safeMetadata,
    // Stack solo in development
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  }

  logger.error(`${context} [${category}] ${error.message}`, logData)
}
