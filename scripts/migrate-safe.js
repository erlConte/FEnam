// scripts/migrate-safe.js
// Script "smart" per eseguire migrazioni Prisma in modo sicuro.
// Su Vercel (IPv4-only): usare SKIP_MIGRATIONS=true e solo DATABASE_URL (pooler).
// Migrazioni vanno eseguite da locale con DIRECT_URL (IPv4) o da Supabase SQL Editor.

const { execSync } = require('child_process')
const { exit } = require('process')

const SKIP_MIGRATIONS = process.env.SKIP_MIGRATIONS === 'true'
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'

console.log('🔄 [Migrate Safe] Avvio...')
console.log(`   Environment: ${IS_PRODUCTION ? 'production' : 'development'}`)
console.log(`   SKIP_MIGRATIONS: ${SKIP_MIGRATIONS}`)

// Guard: se SKIP_MIGRATIONS=true NON eseguire mai migrate deploy (evita uso DIRECT_URL su Vercel)
if (SKIP_MIGRATIONS) {
  console.log('✅ [Migrate Safe] SKIP_MIGRATIONS=true → salto migrazioni (nessun prisma migrate deploy)')
  console.log('   Runtime userà solo DATABASE_URL (pooler). Applica migrazioni da locale o Supabase SQL Editor.')
  exit(0)
}

// Verifica che DIRECT_URL sia configurato (richiesto per migrate deploy)
if (!process.env.DIRECT_URL) {
  console.warn('⚠️  [Migrate Safe] DIRECT_URL non configurato')
  console.warn('   Le migrazioni richiedono una direct connection (porta 5432)')
  console.warn('   DATABASE_URL (pooler) non supporta DDL operations')
  
  if (IS_PRODUCTION) {
    console.error('❌ [Migrate Safe] DIRECT_URL mancante in produzione e SKIP_MIGRATIONS=false')
    console.error('   Su Vercel imposta SKIP_MIGRATIONS=true e usa solo DATABASE_URL (pooler)')
    exit(1)
  }
  
  console.warn('   Continuo comunque (development mode)...')
}

try {
  console.log('📦 [Migrate Safe] Eseguo: prisma migrate deploy')
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  })
  console.log('✅ [Migrate Safe] Migrazioni applicate con successo')
  exit(0)
} catch (error) {
  const errorMessage = error.message || error.toString()
  const stderr = error.stderr?.toString() || ''
  const stdout = error.stdout?.toString() || ''
  
  // Identifica errori di connessione
  const isConnectionError =
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('getaddrinfo') ||
    errorMessage.includes('IPv4') ||
    errorMessage.includes('IPv6') ||
    stderr.includes('ENOTFOUND') ||
    stderr.includes('ETIMEDOUT') ||
    stderr.includes('ECONNREFUSED') ||
    stderr.includes('getaddrinfo') ||
    stderr.includes('IPv4') ||
    stderr.includes('IPv6')
  
  if (isConnectionError) {
    console.error('❌ [Migrate Safe] Errore di connessione al database')
    console.error('   Possibili cause:')
    console.error('   - DIRECT_URL non raggiungibile (Vercel IPv4-only, Supabase può essere IPv6)')
    console.error('   - Network timeout o firewall')
    console.error('   - Credenziali errate')
    console.error('')
    console.error('   Dettagli errore:')
    console.error(`   ${errorMessage.substring(0, 200)}...`)
    
    if (IS_PRODUCTION && SKIP_MIGRATIONS) {
      console.warn('⚠️  [Migrate Safe] SKIP_MIGRATIONS=true in produzione')
      console.warn('   Deploy continuerà senza applicare migrazioni')
      console.warn('   ⚠️  IMPORTANTE: Applica migrazioni manualmente via Supabase SQL Editor')
      exit(0)
    }
    
    if (IS_PRODUCTION) {
      console.error('❌ [Migrate Safe] Errore in produzione e SKIP_MIGRATIONS=false')
      console.error('   Per saltare migrazioni, imposta SKIP_MIGRATIONS=true in Vercel')
      console.error('   Oppure risolvi il problema di connessione DIRECT_URL')
      exit(1)
    }
    
    // In development, fallisce sempre
    console.error('❌ [Migrate Safe] Errore in development, termino con errore')
    exit(1)
  }
  
  // Altri errori (migrazioni già applicate, schema drift, ecc.)
  console.error('❌ [Migrate Safe] Errore durante migrazioni')
  console.error('   Tipo: Errore non di connessione')
  console.error('   Dettagli:')
  console.error(`   ${errorMessage.substring(0, 300)}`)
  
  // In produzione con SKIP_MIGRATIONS, logga ma continua
  if (IS_PRODUCTION && SKIP_MIGRATIONS) {
    console.warn('⚠️  [Migrate Safe] SKIP_MIGRATIONS=true, continuo comunque')
    exit(0)
  }
  
  // Altrimenti fallisci
  exit(1)
}
