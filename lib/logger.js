// lib/logger.js
// Logger standardizzato per il progetto

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
 * Log error strutturato con categoria e metadata Vercel
 * @param {string} context - Contesto (es. "[PayPal API]")
 * @param {Error} error - Errore da loggare
 * @param {object} metadata - Metadata aggiuntivo (senza dati sensibili)
 * @param {string} category - Categoria errore (DB_CONN, PRISMA, VALIDATION, PAYPAL, AUTH, UNKNOWN)
 */
export function logErrorStructured(context, error, metadata = {}, category = 'UNKNOWN') {
  const requestId = process.env.VERCEL_REQUEST_ID || process.env.VERCEL_FUNCTION_INVOCATION_ID || 'local'
  
  const logData = {
    category,
    errorName: error.name,
    errorCode: error.code || error.statusCode || null,
    message: error.message,
    requestId,
    ...metadata,
    // Stack solo in development
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  }

  logger.error(`${context} [${category}] ${error.message}`, logData)
}
