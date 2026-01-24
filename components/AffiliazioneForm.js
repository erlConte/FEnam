import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import { useRouter } from 'next/router'
import 'react-toastify/dist/ReactToastify.css'

const schema = z.object({
  nome:     z.string().min(2, 'Obbligatorio'),
  cognome:  z.string().min(2, 'Obbligatorio'),
  email:    z.string().email('Email non valida'),
  telefono: z.string().min(5, 'Obbligatorio'),
  privacy:  z.boolean().refine(Boolean, { message: 'Richiesto' }),
  donazione:z.string().optional(), // testo, convertirai a numero
})

// Converte donazione da string a numero (vuoto -> 0)
function parseDonazione(donazione) {
  if (!donazione || donazione === '') return 0
  const num = parseFloat(donazione)
  return isNaN(num) ? 0 : Math.max(0, num)
}

export default function AffiliazioneForm() {
  const [sdkReady, setSdkReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const paypalRef = useRef(null)
  const handoffParamsRef = useRef({ returnUrl: null, source: null })
  const router = useRouter()
  
  // Leggi e conserva query params per handoff (return e source) usando ref per stabilità
  const { return: returnParam, source } = router.query

  // Aggiorna handoff params ref quando router.query cambia (solo quando router è ready)
  useEffect(() => {
    if (router.isReady) {
      handoffParamsRef.current = {
        returnUrl: typeof returnParam === 'string' ? returnParam : null,
        source: typeof source === 'string' ? source : null,
      }
    }
  }, [router.isReady, returnParam, source])

  const {
    register,
    formState: { errors },
    getValues,
    watch,
  } = useForm({ resolver: zodResolver(schema) })

  // Watch donazione per decidere quale bottone mostrare
  const donazioneValue = watch('donazione')
  const donazioneNum = parseDonazione(donazioneValue)

  /* carica SDK PayPal una sola volta (solo se necessario) */
  useEffect(() => {
    // Carica PayPal SDK solo se donazione > 0
    if (donazioneNum <= 0) return
    
    if (window.paypal) return setSdkReady(true)
    
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
    if (!clientId) {
      console.error('NEXT_PUBLIC_PAYPAL_CLIENT_ID is missing')
      toast.error('Configurazione PayPal mancante')
      return
    }
    
    const s = document.createElement('script')
    s.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR`
    s.onload = () => setSdkReady(true)
    s.onerror = () => {
      console.error('Failed to load PayPal SDK')
      toast.error('Errore caricamento PayPal')
    }
    document.body.appendChild(s)
  }, [donazioneNum])

  /* render bottone PayPal (solo se donazione > 0) */
  useEffect(() => {
    if (donazioneNum <= 0 || !sdkReady || !paypalRef.current) {
      // Pulisci contenuto se non serve PayPal
      if (paypalRef.current) {
        paypalRef.current.innerHTML = ''
      }
      return
    }

    // Pulisci contenuto prima di renderizzare nuovo bottone
    paypalRef.current.innerHTML = ''

    window.paypal.Buttons({
      style: { layout: 'vertical', label: 'paypal', height: 40 },

      /* crea ordine */
      createOrder: async () => {
        const payload = getValues()
        // Assicurati che donazione sia passata come numero
        const payloadWithDonazione = {
          ...payload,
          donazione: parseDonazione(payload.donazione),
        }
        const res  = await fetch('/api/affiliazione/paypal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadWithDonazione),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Errore ordine')
        return json.orderID
      },

      onApprove: async (data) => {
        try {
          // Chiama API capture server-side
          const res = await fetch('/api/affiliazione/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID }),
          })

          const json = await res.json()

          if (!res.ok) {
            const errorMsg = json.error || json.details || 'Errore durante la conferma del pagamento'
            toast.error(errorMsg)
            console.error('Errore capture:', json)
            return
          }

          toast.success('Affiliazione completata!')
          
          // Gestione handoff (stessa logica per entrambi i flussi)
          await handleSuccessRedirect(data.orderID)
        } catch (err) {
          console.error('Errore durante capture:', err)
          toast.error('Errore durante la conferma del pagamento')
        }
      },
      onError: (err) => {
        console.error('Errore PayPal:', err)
        toast.error('Errore PayPal')
      },
    }).render(paypalRef.current)
  }, [sdkReady, donazioneNum]) // getValues è stabile, non serve nelle dipendenze

  // Funzione condivisa per gestire redirect dopo successo (gratuito o PayPal)
  const handleSuccessRedirect = async (orderID) => {
    // Usa ref per accedere ai parametri handoff in modo stabile
    const params = handoffParamsRef.current
    
    // Prova handoff solo se source === "enotempo" o se c'è returnUrl valido
    if (params.source === 'enotempo' || params.returnUrl) {
      try {
        const handoffRes = await fetch('/api/affiliazione/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderID,
            returnUrl: params.returnUrl,
            source: params.source,
          }),
        })

        const handoffJson = await handoffRes.json()

        if (handoffRes.ok && handoffJson.redirectUrl) {
          // Redirect a URL esterno con token
          setTimeout(() => {
            window.location.href = handoffJson.redirectUrl
          }, 1500)
          return
        }
        console.warn('Handoff non disponibile, uso redirect interno:', handoffJson)
      } catch (handoffErr) {
        console.error('Errore handoff:', handoffErr)
      }
    }
    
    // Redirect normale a pagina successo FeNAM
    setTimeout(() => {
      router.push(`/affiliazione/success?orderId=${orderID}`)
    }, 1500)
  }

  // Handler per affiliazione gratuita
  const handleFreeAffiliation = async (e) => {
    e.preventDefault()
    
    if (isSubmitting) return
    
    const formData = getValues()
    const donazioneNum = parseDonazione(formData.donazione)
    
    // Verifica che donazione sia <= 0
    if (donazioneNum > 0) {
      toast.error('Per donazioni > 0, usa il bottone PayPal')
      return
    }

    setIsSubmitting(true)
    
    try {
      const payload = {
        ...formData,
        donazione: 0, // Forza a 0 per sicurezza
      }

      const res = await fetch('/api/affiliazione/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        const errorMsg = json.error || json.details || 'Errore durante la creazione dell\'affiliazione'
        toast.error(errorMsg)
        console.error('Errore affiliazione gratuita:', json)
        return
      }

      toast.success('Affiliazione completata!')
      
      // Usa stessa logica di redirect del flusso PayPal
      await handleSuccessRedirect(json.orderID)
    } catch (err) {
      console.error('Errore durante affiliazione gratuita:', err)
      toast.error('Errore durante la creazione dell\'affiliazione')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()}
          className="form-col space-y-6 rounded-3xl bg-[#8fd1d2] p-8 text-secondary">

      <h2 className="text-3xl font-bold">Carta di Affiliazione</h2>

      {['nome', 'cognome', 'email', 'telefono'].map((f) => (
        <div key={f}>
          <label className="mb-1 block text-sm capitalize">{f}</label>
          <input {...register(f)} type={f === 'email' ? 'email' : 'text'} className="input-field" />
          {errors[f] && <p className="mt-1 text-xs text-red-600">{errors[f].message}</p>}
        </div>
      ))}

      {/* Importo donazione facoltativo */}
      <div>
        <label className="mb-1 block text-sm">Donazione extra (facoltativa)</label>
        <input
          {...register('donazione')}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className="input-field"
        />
        {errors.donazione && (
          <p className="mt-1 text-xs text-red-600">{errors.donazione.message}</p>
        )}
      </div>

      {/* Privacy */}
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" {...register('privacy')} className="h-4 w-4" /> Accetto termini &amp; privacy *
      </label>
      {errors.privacy && <p className="mt-1 text-xs text-red-600">{errors.privacy.message}</p>}

      {/* Messaggio informativo */}
      <p className="pt-4 text-center text-sm">Affiliazione gratuita — donazione facoltativa</p>

      {/* Bottone gratuito o PayPal in base a donazione */}
      {donazioneNum <= 0 ? (
        <button
          type="button"
          onClick={handleFreeAffiliation}
          disabled={isSubmitting}
          className="w-full rounded-lg bg-[#12A969] px-6 py-3 text-white font-semibold hover:bg-[#0f8a55] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Elaborazione...' : 'Conferma affiliazione gratuita'}
        </button>
      ) : (
        <div ref={paypalRef} className="w-full" />
      )}
    </form>
  )
}
