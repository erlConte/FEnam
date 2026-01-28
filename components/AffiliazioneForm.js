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
  donazione: z
    .union([z.string(), z.number()])
    .transform((val) => {
      if (val === undefined || val === null || val === '') return 10
      const num = typeof val === 'string' ? parseFloat(val) : val
      return isNaN(num) ? 10 : Math.max(10, num)
    })
    .pipe(z.number().min(10, 'La donazione minima è €10')),
})

// Converte donazione da string a numero (vuoto -> 10, default)
function parseDonazione(donazione) {
  if (!donazione || donazione === '') return 10
  const num = parseFloat(donazione)
  return isNaN(num) ? 10 : Math.max(10, num)
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
  } = useForm({ 
    resolver: zodResolver(schema),
    defaultValues: {
      donazione: '10'
    }
  })

  // Watch donazione
  const donazioneValue = watch('donazione')
  const donazioneNum = parseDonazione(donazioneValue)

  /* carica SDK PayPal una sola volta */
  useEffect(() => {
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
  }, [])

  /* render bottone PayPal */
  useEffect(() => {
    if (!sdkReady || !paypalRef.current) {
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

          // IMPORTANTE: Verifica res.ok PRIMA di mostrare successo
          // Se res.ok è false, il pagamento PayPal è completato ma il DB update è fallito
          if (!res.ok) {
            // Distingui tra errori diversi
            let errorMsg = 'Errore durante la conferma del pagamento'
            
            if (res.status === 500 && json.details?.correlationId) {
              // Errore DB: pagamento completato ma DB update fallito
              errorMsg = 'Il pagamento è stato completato ma si è verificato un errore tecnico. Contatta il supporto con l\'ID ordine: ' + data.orderID
              console.error('[Affiliazione] Errore DB dopo pagamento PayPal:', {
                orderID: data.orderID,
                correlationId: json.details.correlationId,
                error: json.error,
                message: json.message,
              })
            } else if (res.status === 502) {
              // Errore PayPal
              errorMsg = json.message || 'Errore durante il processamento del pagamento PayPal'
            } else {
              // Altri errori
              errorMsg = json.message || json.error || 'Errore durante la conferma del pagamento'
            }
            
            toast.error(errorMsg)
            console.error('[Affiliazione] Errore capture:', {
              status: res.status,
              orderID: data.orderID,
              response: json,
            })
            return
          }

          // Solo se res.ok === true, mostra successo
          toast.success('Affiliazione completata!')
          
          // Gestione handoff (stessa logica per entrambi i flussi)
          await handleSuccessRedirect(data.orderID)
        } catch (err) {
          // Errore di rete o altro errore non gestito
          console.error('[Affiliazione] Errore durante capture:', err)
          toast.error('Errore di connessione durante la conferma del pagamento. Verifica la tua connessione e riprova.')
        }
      },
      onError: (err) => {
        console.error('Errore PayPal:', err)
        toast.error('Errore PayPal')
      },
    }).render(paypalRef.current)
  }, [sdkReady, donazioneNum]) // getValues è stabile, non serve nelle dipendenze

  // Funzione per gestire redirect dopo successo
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

      {/* Donazione obbligatoria */}
      <div>
        <label className="mb-1 block text-sm">Donazione (€)</label>
        <input
          {...register('donazione')}
          type="number"
          step="1"
          min="10"
          defaultValue="10"
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

      {/* Bottone PayPal */}
      <div ref={paypalRef} className="w-full" />
    </form>
  )
}
