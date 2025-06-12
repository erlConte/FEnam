// pages/affiliazione.js
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { toast, ToastContainer } from 'react-toastify'
import AffiliazioneForm from '../components/AffiliazioneForm'

export default function AffiliazionePage() {
  const { query } = useRouter()

  useEffect(() => {
    if (query.success) {
      toast.success('Pagamento effettuato con successo!')
    }
  }, [query.success])

  return (
    <>
      <ToastContainer position="top-center" autoClose={5000} />
      {/* già esistente: Head, Hero, Offerta Servizi… */}
      <section className="bg-paper pb-24 pt-10">
        <div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-14">
          <AffiliazioneForm />
          {/* descrizione colonna destra… */}
        </div>
      </section>
      {/* resto della pagina… */}
    </>
  )
}
