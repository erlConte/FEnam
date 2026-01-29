// pages/admin/soci.js
// Dashboard admin read-only per gestione affiliazioni
import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function AdminSoci() {
  const [token, setToken] = useState('')
  const [storedToken, setStoredToken] = useState('')
  const [affiliations, setAffiliations] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [membershipFilter, setMembershipFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [skip, setSkip] = useState(0)
  const [take] = useState(50)
  const [resendingCard, setResendingCard] = useState(null) // ID tessera in fase di reinvio

  // Carica token da localStorage al mount
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) {
      setStoredToken(savedToken)
      setToken(savedToken)
    }
  }, [])

  // Fetch affiliazioni
  const fetchAffiliations = async (authToken) => {
    if (!authToken) {
      setError('Token richiesto')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        take: take.toString(),
        skip: skip.toString(),
      })

      if (statusFilter) {
        params.append('status', statusFilter)
      }

      if (membershipFilter) {
        params.append('membershipFilter', membershipFilter)
      }

      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim())
      }

      const response = await fetch(`/api/admin/affiliations?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })

      if (response.status === 401) {
        setError('Token non valido. Controlla ADMIN_TOKEN.')
        setStoredToken('')
        localStorage.removeItem('admin_token')
        return
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Errore nel caricamento dati')
      }

      const data = await response.json()
      setAffiliations(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Errore fetch affiliazioni:', err)
      setError(err.message || 'Errore nel caricamento dati')
    } finally {
      setLoading(false)
    }
  }

  // Carica dati quando cambiano filtri o token
  useEffect(() => {
    if (storedToken) {
      fetchAffiliations(storedToken)
    }
  }, [storedToken, statusFilter, membershipFilter, searchQuery, skip])

  // Funzione per reinviare tessera
  const handleResendCard = async (affiliationId, memberNumber) => {
    if (!confirm(`Vuoi reinviare la tessera ${memberNumber}?`)) {
      return
    }

    setResendingCard(affiliationId)
    try {
      const response = await fetch(`/api/admin/resend-card?id=${affiliationId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Errore nel reinvio tessera')
      }

      const data = await response.json()
      alert(`✅ ${data.message || 'Tessera reinviata con successo'}${data.memberNumber ? ` (${data.memberNumber})` : ''}`)
      // Ricarica dati
      fetchAffiliations(storedToken)
    } catch (err) {
      console.error('Errore reinvio tessera:', err)
      alert(`❌ Errore: ${err.message}`)
    } finally {
      setResendingCard(null)
    }
  }

  // Salva token e ricarica
  const handleSaveToken = () => {
    if (!token.trim()) {
      setError('Inserisci un token valido')
      return
    }
    localStorage.setItem('admin_token', token)
    setStoredToken(token)
    setSkip(0) // Reset paginazione
  }

  // Formattazione date
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Badge status
  const StatusBadge = ({ status }) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    }
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          colors[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {status === 'pending' ? 'In attesa' : 'Completata'}
      </span>
    )
  }

  // Calcola stato membership
  const getMembershipStatus = (aff) => {
    if (aff.status !== 'completed') {
      return { status: 'PENDING', label: 'In attesa', color: 'bg-yellow-100 text-yellow-800' }
    }
    if (!aff.memberUntil) {
      return { status: 'PENDING', label: 'In attesa', color: 'bg-yellow-100 text-yellow-800' }
    }
    const now = new Date()
    const until = new Date(aff.memberUntil)
    if (until > now) {
      return { status: 'ACTIVE', label: 'Attiva', color: 'bg-green-100 text-green-800' }
    }
    return { status: 'EXPIRED', label: 'Scaduta', color: 'bg-red-100 text-red-800' }
  }

  // Badge membership status
  const MembershipBadge = ({ aff }) => {
    const membership = getMembershipStatus(aff)
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${membership.color}`}
      >
        {membership.label}
      </span>
    )
  }

  return (
    <>
      <Head>
        <title>Admin - Gestione Soci | FENAM</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">Dashboard Admin - Soci</h1>

          {/* Token input (solo se non salvato) */}
          {!storedToken && (
            <div className="mb-6 rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold">Autenticazione</h2>
              <div className="flex gap-4">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Inserisci ADMIN_TOKEN"
                  className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleSaveToken()
                  }}
                />
                <button
                  onClick={handleSaveToken}
                  className="rounded-md bg-primary px-6 py-2 font-semibold text-white hover:bg-primary/90"
                >
                  Accedi
                </button>
              </div>
            </div>
          )}

          {/* Errore */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
              <p className="font-semibold">Errore:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Dashboard (solo se autenticato) */}
          {storedToken && (
            <>
              {/* Filtri */}
              <div className="mb-6 rounded-lg bg-white p-6 shadow">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value)
                        setSkip(0)
                      }}
                      className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Tutti</option>
                      <option value="pending">In attesa</option>
                      <option value="completed">Completate</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Membership
                    </label>
                    <select
                      value={membershipFilter}
                      onChange={(e) => {
                        setMembershipFilter(e.target.value)
                        setSkip(0)
                      }}
                      className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Tutti</option>
                      <option value="active">Solo attivi</option>
                      <option value="expired">Scaduti</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Cerca (email, nome, cognome, orderId)
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setSkip(0)
                      }}
                      placeholder="Cerca..."
                      className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setSkip(0)
                        fetchAffiliations(storedToken)
                      }}
                      disabled={loading}
                      className="w-full rounded-md bg-primary px-6 py-2 font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {loading ? 'Caricamento...' : 'Aggiorna'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Statistiche */}
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-white p-4 shadow">
                  <p className="text-sm text-gray-600">Totale Affiliazioni</p>
                  <p className="text-2xl font-bold text-gray-900">{total}</p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow">
                  <p className="text-sm text-gray-600">Visualizzate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {affiliations.length} / {total}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-4 shadow">
                  <p className="text-sm text-gray-600">Pagina</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.floor(skip / take) + 1} / {Math.ceil(total / take) || 1}
                  </p>
                </div>
              </div>

              {/* Tabella */}
              <div className="overflow-hidden rounded-lg bg-white shadow">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Caricamento...</div>
                ) : affiliations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">Nessuna affiliazione trovata</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Data
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Membership
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Nome
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Cognome
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Payer Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Numero Tessera
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Order ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Scadenza
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Email Inviata
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Tessera Inviata
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {affiliations.map((aff) => (
                          <tr key={aff.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {formatDate(aff.createdAt)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              <StatusBadge status={aff.status} />
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              <MembershipBadge aff={aff} />
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {aff.nome}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {aff.cognome}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                              {aff.email}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                              {aff.payerEmail || '-'}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                              {aff.memberNumber ? (
                                <span className="font-semibold text-primary">{aff.memberNumber}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-500">
                              {aff.orderId || '-'}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                              {aff.memberUntil ? (
                                <span
                                  className={
                                    new Date(aff.memberUntil) > new Date()
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }
                                >
                                  {formatDate(aff.memberUntil)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                              {aff.confirmationEmailSentAt ? (
                                <span className="text-green-600">
                                  {formatDate(aff.confirmationEmailSentAt)}
                                </span>
                              ) : (
                                <span className="text-gray-400">Non inviata</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                              {aff.membershipCardSentAt ? (
                                <span className="text-green-600">
                                  {formatDate(aff.membershipCardSentAt)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm">
                              {aff.status === 'completed' && aff.memberNumber ? (
                                <button
                                  onClick={() => handleResendCard(aff.id, aff.memberNumber)}
                                  disabled={resendingCard === aff.id}
                                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {resendingCard === aff.id ? 'Invio...' : 'Reinvia tessera'}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Paginazione */}
              {total > take && (
                <div className="mt-6 flex items-center justify-between">
                  <button
                    onClick={() => setSkip(Math.max(0, skip - take))}
                    disabled={skip === 0 || loading}
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50 disabled:opacity-50"
                  >
                    Precedente
                  </button>
                  <span className="text-sm text-gray-700">
                    Mostrando {skip + 1} - {Math.min(skip + take, total)} di {total}
                  </span>
                  <button
                    onClick={() => setSkip(skip + take)}
                    disabled={skip + take >= total || loading}
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50 disabled:opacity-50"
                  >
                    Successivo
                  </button>
                </div>
              )}

              {/* Logout */}
              <div className="mt-6 text-right">
                <button
                  onClick={() => {
                    localStorage.removeItem('admin_token')
                    setStoredToken('')
                    setToken('')
                    setAffiliations([])
                    setError(null)
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Esci
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
