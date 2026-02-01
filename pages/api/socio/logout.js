// GET /api/socio/logout — Cancella cookie sessione socio e redirect a /accedi-socio?loggedOut=1

import { COOKIE_NAME, getCookieOptions, formatSetCookie, getRequestHost } from '../../../lib/memberSession'

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).send('Method Not Allowed')
  }

  const host = getRequestHost(req)
  const opts = getCookieOptions({ clear: true, host })
  res.setHeader('Set-Cookie', formatSetCookie(COOKIE_NAME, '', opts))
  res.redirect(302, '/accedi-socio?loggedOut=1')
}
