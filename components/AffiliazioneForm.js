import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
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

  const {
    register,
    formState: { errors },
    getValues,
  } = useForm({ resolver: zodResolver(schema) })

  /* carica SDK PayPal una sola volta */
  useEffect(() => {
    if (window.paypal) return setSdkReady(true)
    const s = document.createElement('script')
    s.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&currency=EUR`
    s.onload = () => setSdkReady(true)
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

      onApprove: () => toast.success('Pagamento completato!'),
      onError:   () => toast.error('Errore PayPal'),
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
