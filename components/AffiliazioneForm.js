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
      if (val === undefined || val === null || val === '') return 0
      const num = typeof val === 'string' ? parseFloat(val) : val
      return isNaN(num) ? 0 : num
    })
    .pipe(z.number().min(0, 'La donazione non può essere negativa').max(10000, 'Donazione massima €10.000')),
})

// Converte donazione da string a numero (vuoto -> 0)
function parseDonazione(donazione) {
  if (donazione === undefined || donazione === null || donazione === '') return 0
  const num = Number(parseFloat(donazione))
  return isNaN(num) ? 0 : num
}

export default function AffiliazioneForm() {
  const [sdkReady, setSdkReady] = useState(false)
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

  // Watch donazione (normalizzata: numero, minimo 0 per decisioni UI)
  const donazioneValue = watch('donazione')
  const donazioneNum = Math.max(0, parseDonazione(donazioneValue))

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
        const rawDonazione = parseDonazione(payload.donazione)
        // Hardening: clamp minimo 10 per PayPal (anche se DOM forzato)
        const donazioneForPaypal = Math.max(10, rawDonazione)
        const payloadWithDonazione = {
          ...payload,
          donazione: donazioneForPaypal,
        }
        const res  = await fetch('/api/affiliazione/paypal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadWithDonazione),
        })
        const json = await res.json()
        if (!res.ok) {
          if (res.status === 409) {
            toast.warning(json.message || 'Sei già socio attivo. Usa "Accedi come socio" per accedere senza ripagare.')
            if (json.details?.accediSocioUrl) {
              setTimeout(() => { window.location.href = json.details.accediSocioUrl }, 1500)
            }
          }
          throw new Error(json.message || json.error || 'Errore ordine')
        }
        return json.orderID
      },

      onApprove: async (data) => {
        try {
          const payload = getValues()
          const captureBody = {
            orderID: data.orderID,
            nome: payload.nome,
            cognome: payload.cognome,
            email: payload.email,
            telefono: payload.telefono,
            privacy: !!payload.privacy,
          }
          console.log('[Affiliazione] Capture in corso', { orderID: data.orderID })
          const res = await fetch('/api/affiliazione/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(captureBody),
          })

          const contentType = res.headers.get('content-type') || ''
          if (res.ok && contentType.includes('text/html')) {
            const html = await res.text()
            document.open()
            document.write(html)
            document.close()
            return
          }

          let json
          try {
            json = await res.json()
          } catch (parseErr) {
            console.error('[Affiliazione] Capture response non JSON', parseErr)
            toast.error('Errore durante la conferma del pagamento.')
            return
          }

          if (res.ok && json.correlationId) {
            console.log('[Affiliazione] Capture completata', { orderID: data.orderID, correlationId: json.correlationId })
          } else {
            console.error('[Affiliazione] Capture fallita', { orderID: data.orderID, status: res.status, error: json.error, message: json.message })
          }

          // Pagamento non ancora completato (es. PENDING): messaggio chiaro senza panico
          if (res.ok && json.paypalStatus && json.paypalStatus !== 'COMPLETED') {
            const msg = json.message || 'PayPal sta processando il pagamento. Riprova tra qualche minuto.'
            toast.warning(msg)
            console.warn('[Affiliazione] PayPal status non COMPLETED', {
              orderID: data.orderID,
              paypalStatus: json.paypalStatus,
              correlationId: json.correlationId,
            })
            return
          }

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
          if (json.warnings && json.warnings.length > 0) {
            // Pagamento completato ma side effects con warnings
            toast.success('Pagamento completato! Email e tessera in invio...')
            console.warn('[Affiliazione] Warnings:', {
              orderID: data.orderID,
              correlationId: json.correlationId,
              warnings: json.warnings,
            })
          } else {
            toast.success('Affiliazione completata!')
          }
          
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
  }, [sdkReady, donazioneNum >= 10]) // PayPal solo se donazione >= 10

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

      {/* CTA: solo PayPal se donazione >= 10; altrimenti nessuna CTA */}
      {donazioneNum >= 10 ? (
        <div ref={paypalRef} className="w-full" />
      ) : null}
    </form>
  )
}
