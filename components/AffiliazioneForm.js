// components/AffiliazioneForm.js
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Schema di validazione
const schema = z.object({
  nome:     z.string().min(2, 'Obbligatorio'),
  cognome:  z.string().min(2, 'Obbligatorio'),
  email:    z.string().email('Email non valida'),
  telefono: z.string().min(5, 'Obbligatorio'),
  privacy:  z.boolean().refine(v => v, { message: 'Richiesto' }),
})

export default function AffiliazioneForm() {
  const [scriptReady, setScriptReady] = useState(false)
  const paypalRef = useRef()
  const {
    register,
    formState: { errors },
    getValues,
  } = useForm({ resolver: zodResolver(schema) })

  // Carica il JS SDK di PayPal
  useEffect(() => {
    if (!window.paypal) {
      const s = document.createElement('script')
      s.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=EUR`
      s.onload = () => setScriptReady(true)
      document.body.appendChild(s)
    } else {
      setScriptReady(true)
    }
  }, [])

  // Renderizza il bottone PayPal una volta che lo script è pronto
  useEffect(() => {
    if (!scriptReady || !paypalRef.current) return

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        shape: 'rect',
        label: 'paypal',
        height: 40,
      },

      // Creazione dell'ordine
      createOrder: async () => {
        const values = getValues()
        console.log('[PayPal] createOrder with values:', values)

        const res = await fetch('/api/affiliazione/paypal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })
        const json = await res.json()
        console.log('[PayPal] /api/affiliazione/paypal response:', res.status, json)

        if (!res.ok || !json.orderID) {
          const errMsg = json.error || 'Nessun orderID restituito'
          toast.error(`[PayPal] Errore: ${errMsg}`)
          throw new Error(errMsg)
        }
        return json.orderID
      },

      // Cattura dell'ordine al click di conferma
      onApprove: async (data, actions) => {
        try {
          const details = await actions.order.capture()
          console.log('[PayPal] capture details:', details)
          toast.success('Pagamento effettuato con successo!')
        } catch (captureErr) {
          console.error('[PayPal] capture error:', captureErr)
          toast.error('Errore durante la cattura del pagamento')
        }
      },

      onError: (err) => {
        console.error('[PayPal] onError', err)
        toast.error('Errore PayPal, controlla console.')
      },
      onCancel: () => {
        toast.info('Pagamento annullato.')
      },
    }).render(paypalRef.current)
  }, [scriptReady, getValues])

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="form-col space-y-6 rounded-3xl bg-[#8fd1d2] p-8 text-secondary"
    >
      <h2 className="text-3xl font-bold">Carta di Affiliazione</h2>

      {['nome', 'cognome', 'email', 'telefono'].map((field) => (
        <div key={field}>
          <label className="mb-1 block text-sm capitalize">
            {field}
            {field === 'email' && ' *'}
          </label>
          <input
            {...register(field)}
            type={field === 'email' ? 'email' : 'text'}
            className="input-field"
          />
          {errors[field] && (
            <p className="mt-1 text-xs text-red-600">
              {errors[field].message}
            </p>
          )}
        </div>
      ))}

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          {...register('privacy')}
          className="h-4 w-4"
        />
        Accetto termini &amp; privacy *
      </label>
      {errors.privacy && (
        <p className="mt-1 text-xs text-red-600">
          {errors.privacy.message}
        </p>
      )}

      {/* PayPal Button container */}
      <div ref={paypalRef} className="w-full mt-4"></div>

      <p className="text-center text-xs">
        Carta di affiliazione €85/anno
      </p>
    </form>
  )
}
