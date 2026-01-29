// pages/api/admin/debug/db.js
// Endpoint debug: ritorna host, port, env, skipMigrations (nessun segreto)
import { checkMethod, requireAdminAuth, sendError, sendSuccess } from '../../../../lib/apiHelpers'
import { handleCors } from '../../../../lib/cors'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (!checkMethod(req, res, ['GET'])) return
  if (!requireAdminAuth(req, res)) return

  try {
    const dbUrl = process.env.DATABASE_URL
    let host = 'unknown'
    let port = 'default'

    if (dbUrl) {
      try {
        const u = new URL(dbUrl)
        host = u.hostname || 'unknown'
        port = u.port || (u.protocol === 'postgresql:' ? '5432' : 'default')
      } catch {
        // leave host/port as above
      }
    }

    const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
    const skipMigrations = process.env.SKIP_MIGRATIONS === 'true'
    const mode =
      host.includes('pooler') || port === '6543' || (dbUrl && dbUrl.includes('pgbouncer=true'))
        ? 'pooler'
        : 'direct'

    return sendSuccess(res, {
      host,
      port,
      env,
      skipMigrations,
      mode,
    })
  } catch (err) {
    return sendError(res, 500, 'Internal error', err.message)
  }
}
