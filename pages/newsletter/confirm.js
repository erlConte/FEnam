// pages/newsletter/confirm.js
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export default function ConfirmNewsletterPage() {
  const { query } = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!query.token) return
    fetch(`/api/confirm?token=${query.token}`)
      .then(res => res.json())
      .then(json => {
        if (json.ok) {
          toast.success(json.message || 'Iscrizione confermata!')
        } else {
          toast.error(json.error || 'Errore nella conferma')
        }
      })
      .catch(() => {
        toast.error('Errore di rete, riprova più tardi')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [query.token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-night text-white">
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        pauseOnHover
      />
      {loading
        ? <p>Verifico la conferma...</p>
        : <p>Puoi chiudere questa finestra.</p>
      }
    </div>
  )
}
