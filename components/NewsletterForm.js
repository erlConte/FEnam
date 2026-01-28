// components/NewsletterForm.js
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const schema = z.object({
  email: z.string().email('Email non valida'),
  consent: z
    .boolean({ required_error: 'Consenso obbligatorio' })
    .refine(v => v, { message: 'Devi accettare il consenso' }),
})

export default function NewsletterForm() {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', consent: false },
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),           // <-- qui mandiamo sia email che consent
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        // Messaggio corretto: non viene inviata email di conferma, solo aggiunta a audience
        toast.success('Iscrizione completata!')
        reset()
      } else {
        // mostriamo il messaggio user-friendly ricevuto dal server
        toast.error(json.message || json.error || 'Errore durante l\'iscrizione')
      }
    } catch (err) {
      toast.error(err.message || 'Errore di rete, riprova più tardi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 lg:flex lg:gap-4"
    >
      <div className="flex-1">
        <input
          {...register('email')}
          placeholder="Email *"
          className="input-field w-full"
          disabled={loading}
        />
        {errors.email && (
          <p className="text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          {...register('consent')}
          className="h-4 w-4"
          disabled={loading}
        />
        <span>Sì, iscrivimi alla vostra newsletter.</span>
      </div>
      {errors.consent && (
        <p className="text-xs text-red-600">{errors.consent.message}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full border px-8 py-2 disabled:opacity-60"
      >
        {loading ? 'Invio…' : 'Iscriviti'}
      </button>
    </form>
  )
}
