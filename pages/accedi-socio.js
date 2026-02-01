// pages/accedi-socio.js — "Già socio? Accedi" — magic link per handoff senza ripagare
// Query: returnUrl?, source? (da Enotempo)
// Nessun login/sessione: solo email → link → verify → handoff

import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function AccediSocio() {
  const router = useRouter()
  const { returnUrl, source, success, error } = router.query

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const successFromQuery = success === '1'
  const errorFromQuery = error === 'missing_token' && 'Link non valido.'
    || error === 'invalid_or_used' && 'Link scaduto o già usato. Richiedi un nuovo link.'
    || error === 'membership_expired' && 'La tua tessera non è più attiva. Rinnova l’affiliazione.'
    || error === 'invalid_return' && 'Non siamo riusciti a tornare automaticamente al sito richiesto.'
    || null

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
          returnUrl: typeof returnUrl === 'string' && returnUrl.trim() ? returnUrl.trim() : undefined,
          source: typeof source === 'string' && source.trim() ? source.trim() : 'fenam',
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

            {successFromQuery && (
              <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm font-medium">
                Accesso confermato.
              </div>
            )}

            {errorFromQuery && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
                {errorFromQuery}
              </div>
            )}

            {sent && !successFromQuery ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
                Se l’email è associata a un socio attivo, riceverai a breve un link. Controlla la posta (anche spam) e clicca il link per proseguire.
              </div>
            ) : !successFromQuery ? (
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
            ) : null}

            <div className="mt-6 pt-6 border-t border-secondary/20 text-center">
              <Link href="/affiliazione" className="text-sm text-secondary/80 hover:underline">
                Non sei ancora socio? Affiliati qui
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
