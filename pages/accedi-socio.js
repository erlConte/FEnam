// pages/accedi-socio.js — "Già socio? Accedi" — magic link, nessun login/sessione
// Logica solo da router.query: success, source, returnUrl. Nessun cookie/localStorage.

import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'

function isEnotempoReturnUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return false
  const u = url.toLowerCase()
  return u.includes('enotempo.it') || u.includes('enotempo.com')
}

export default function AccediSocio() {
  const router = useRouter()
  const { returnUrl, source, success, error } = router.query

  const isSuccess = router.query.success === '1'
  const sourceNorm = (source || 'fenam').toString().toLowerCase().trim()
  const returnUrlStr = returnUrl != null ? String(returnUrl).trim() : null

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const errorFromQuery = error === 'missing_token' && 'Link non valido.'
    || error === 'invalid_or_used' && 'Link scaduto o già usato. Richiedi un nuovo link.'
    || error === 'membership_expired' && 'La tua tessera non è più attiva. Rinnova l’affiliazione.'
    || error === 'invalid_return' && 'Non siamo riusciti a tornare automaticamente al sito richiesto.'
    || null

  const enotempoHref = sourceNorm === 'enotempo' && returnUrlStr && isEnotempoReturnUrl(returnUrlStr)
    ? returnUrlStr
    : 'https://enotempo.it'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) {
      setErrorMsg('Inserisci la tua email.')
      return
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(email.trim())) {
      setErrorMsg('Email non valida.')
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/socio/login/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          returnUrl: returnUrlStr || undefined,
          source: sourceNorm,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSent(true)
      } else {
        setErrorMsg(data.message || data.error || 'Errore durante l’invio. Riprova.')
      }
    } catch (err) {
      setErrorMsg('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <>
        <Head>
          <title>Accesso confermato | FENAM</title>
          <meta name="description" content="Accesso come socio FENAM confermato." />
        </Head>
        <div className="bg-paper min-h-screen py-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-md">
            <div className="rounded-3xl bg-[#8fd1d2] p-8 text-secondary shadow-lg">
              <h1 className="text-2xl font-bold mb-4">Accesso confermato</h1>
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm mb-6">
                Il tuo accesso come socio FENAM è stato verificato con successo.
              </div>
              <p className="text-sm text-secondary/90 mb-6">
                {sourceNorm === 'enotempo'
                  ? 'Puoi tornare a Enotempo per continuare.'
                  : 'Puoi continuare la navigazione su FENAM.'}
              </p>
              {sourceNorm === 'enotempo' ? (
                <a
                  href={enotempoHref}
                  target="_self"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border-2 border-primary bg-white px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Torna a Enotempo
                </a>
              ) : (
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  Continua su FENAM
                </Link>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Accedi come socio | FENAM</title>
        <meta name="description" content="Se sei già affiliato FENAM, inserisci la tua email per ricevere un link di accesso." />
      </Head>
      <div className="bg-paper min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl bg-[#8fd1d2] p-8 text-secondary shadow-lg">
            <h1 className="text-2xl font-bold mb-2">Già socio? Accedi</h1>
            <p className="text-sm text-secondary/90 mb-6">
              Se sei già affiliato a FENAM, inserisci l’email con cui ti sei iscritto. Ti invieremo un link per accedere (valido pochi minuti).
            </p>

            {errorFromQuery && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
                {errorFromQuery}
              </div>
            )}

            {sent ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
                Se l’email è associata a un socio attivo, riceverai a breve un link. Controlla la posta (anche spam) e clicca il link per proseguire.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="es. nome@dominio.it"
                    className="input-field w-full rounded-lg border border-secondary/30 px-4 py-3"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
                {errorMsg && (
                  <p className="text-sm text-red-600">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-primary px-6 py-3 font-semibold text-white shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Invio in corso...' : 'Invia link'}
                </button>
              </form>
            )}

            {!sent && (
              <div className="mt-6 pt-6 border-t border-secondary/20 text-center">
                <Link href="/affiliazione" className="text-sm text-secondary/80 hover:underline">
                  Non sei ancora socio? Affiliati qui
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
