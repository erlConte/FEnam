// pages/verifica.js
// Pagina pubblica per verificare lo stato di una membership tramite memberNumber

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Verifica() {
  const router = useRouter()
  const [memberNumber, setMemberNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Leggi memberNumber da query string al mount
  useEffect(() => {
    if (router.query.memberNumber) {
      const queryMemberNumber = String(router.query.memberNumber).trim().toUpperCase()
      setMemberNumber(queryMemberNumber)
      // Auto-verifica se presente nella query
      if (queryMemberNumber) {
        handleVerify(queryMemberNumber)
      }
    }
  }, [router.query.memberNumber])

  const handleVerify = async (numberToVerify = null) => {
    const num = numberToVerify || memberNumber.trim().toUpperCase()
    if (!num) {
      setError('Inserisci un numero tessera')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/membership/verify?memberNumber=${encodeURIComponent(num)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la verifica')
      }

      setResult(data)
    } catch (err) {
      console.error('Errore verifica:', err)
      setError(err.message || 'Errore durante la verifica')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    handleVerify()
  }

  const formatDate = (isoString) => {
    if (!isoString) return '-'
    const date = new Date(isoString)
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getStatusBadge = () => {
    if (!result || !result.found) {
      return {
        label: 'Non trovata',
        color: 'bg-gray-100 text-gray-800',
        icon: '❓',
        description: 'Nessuna tessera trovata con questo numero. Verifica di aver inserito correttamente il numero tessera.',
      }
    }

    if (result.active) {
      return {
        label: 'Attiva',
        color: 'bg-green-100 text-green-800',
        icon: '✅',
        description: 'La tua tessera è valida e attiva. Puoi usufruire di tutti i vantaggi riservati ai soci FENAM.',
      }
    }

    if (result.status === 'completed' && result.memberUntil) {
      return {
        label: 'SCADUTA',
        color: 'bg-red-100 text-red-800',
        icon: '⏰',
        description: 'La tua tessera è scaduta. Per rinnovare la membership, completa un nuovo pagamento di affiliazione.',
      }
    }

    if (result.status === 'pending') {
      return {
        label: 'IN ATTESA',
        color: 'bg-yellow-100 text-yellow-800',
        icon: '⏳',
        description: 'Il pagamento è in attesa di conferma. Una volta completato, riceverai la tessera via email.',
      }
    }

    return {
      label: 'Non attiva',
      color: 'bg-gray-100 text-gray-800',
      icon: '❌',
      description: 'La tessera non è attiva. Contatta il supporto per maggiori informazioni.',
    }
  }

  const badge = result ? getStatusBadge() : null

  return (
    <>
      <Head>
        <title>Verifica Tessera - FENAM</title>
        <meta name="description" content="Verifica lo stato della tua tessera socio FENAM" />
      </Head>

      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Verifica Tessera FENAM</h1>
            <p className="text-gray-600 mb-4">
              Verifica rapida dello stato della tua tessera socio tramite numero tessera
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
              <span className="text-sm text-primary font-medium">FENAM - Federazione Nazionale Associazioni Multiculturali</span>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="memberNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Numero Tessera
                </label>
                <input
                  type="text"
                  id="memberNumber"
                  value={memberNumber}
                  onChange={(e) => setMemberNumber(e.target.value.toUpperCase())}
                  placeholder="Es. FENAM-2026-ABC123"
                  className="w-full rounded-md border border-gray-300 px-4 py-3 text-lg font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !memberNumber.trim()}
                className="w-full rounded-md bg-primary px-6 py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifica in corso...' : 'Verifica'}
              </button>
            </form>
          </div>

          {/* Errore */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Risultato */}
          {result && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-gray-100">
                  <span className="text-4xl">{badge?.icon || '❓'}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Risultato Verifica</h2>
                <span
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${badge?.color || 'bg-gray-100 text-gray-800'}`}
                >
                  {badge?.label || 'Sconosciuto'}
                </span>
              </div>

              {result.found ? (
                <div className="space-y-4">
                  {/* Descrizione stato */}
                  {badge?.description && (
                    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-primary">
                      <p className="text-sm text-gray-700">{badge.description}</p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Ente</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-semibold">FENAM</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Stato Pagamento</dt>
                        <dd className="mt-1 text-sm text-gray-900 capitalize">
                          {result.status === 'completed' ? 'Completato' : result.status === 'pending' ? 'In attesa' : result.status}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Validità</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {result.active ? (
                            <span className="text-green-600 font-semibold">Attiva</span>
                          ) : result.status === 'completed' && result.memberUntil ? (
                            <span className="text-red-600 font-semibold">Scaduta</span>
                          ) : (
                            <span className="text-gray-600">Non attiva</span>
                          )}
                        </dd>
                      </div>
                      {result.memberSince && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Valida dal</dt>
                          <dd className="mt-1 text-sm text-gray-900">{formatDate(result.memberSince)}</dd>
                        </div>
                      )}
                      {result.memberUntil && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Valida fino al</dt>
                          <dd className="mt-1 text-sm text-gray-900">
                            <span
                              className={
                                new Date(result.memberUntil) > new Date()
                                  ? 'text-green-600 font-semibold'
                                  : 'text-red-600 font-semibold'
                              }
                            >
                              {formatDate(result.memberUntil)}
                            </span>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-600">
                    Nessuna tessera trovata con il numero inserito. Verifica di aver inserito correttamente il numero tessera.
                  </p>
                </div>
              )}

              {/* Link per nuova verifica */}
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <button
                  onClick={() => {
                    setResult(null)
                    setMemberNumber('')
                    setError(null)
                  }}
                  className="text-primary hover:text-primary/80 text-sm font-medium"
                >
                  Verifica un'altra tessera
                </button>
              </div>
            </div>
          )}

          {/* Info footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Per assistenza, contatta{' '}
              <a href="mailto:info@fenam.it" className="text-primary hover:underline">
                info@fenam.it
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
