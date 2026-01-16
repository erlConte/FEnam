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

export default function AffiliazioneForm() {
  const [sdkReady, setSdkReady] = useState(false)
  const paypalRef = useRef(null)
  const router = useRouter()

  const {
    register,
    formState: { errors },
    getValues,
  } = useForm({ resolver: zodResolver(schema) })

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

  /* render bottone */
  useEffect(() => {
    if (!sdkReady || !paypalRef.current) return

    window.paypal.Buttons({
      style: { layout: 'vertical', label: 'paypal', height: 40 },

      /* crea ordine */
      createOrder: async () => {
        const payload = getValues()
        const res  = await fetch('/api/affiliazione/paypal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
            // Errore nella capture
            const errorMsg = json.error || json.details || 'Errore durante la conferma del pagamento'
            toast.error(errorMsg)
            console.error('Errore capture:', json)
            return
          }

          // Successo
          toast.success('Affiliazione completata!')
          
          // Redirect opzionale a pagina successo
          setTimeout(() => {
            router.push(`/affiliazione/success?orderId=${data.orderID}`)
          }, 1500)
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
  }, [sdkReady])

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

      {/* Bottone PayPal */}
      <p className="pt-4 text-center text-sm">Totale minimo € 85,00</p>
      <div ref={paypalRef} className="w-full" />
    </form>
  )
}
