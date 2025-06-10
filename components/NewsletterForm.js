import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const schema = z.object({
  email:   z.string().email('Email non valida'),
  consent: z.boolean().refine(v => v, { message: 'Consenso obbligatorio' }),
})

export default function NewsletterForm() {
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async ({ email }) => {
    setLoading(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success('Iscrizione completata! Controlla la tua casella.')
        reset()
      } else {
        throw new Error(json.error || 'Errore')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 lg:flex lg:gap-4">
      <div className="flex-1">
        <input
          {...register('email')}
          placeholder="Email *"
          className="input-field w-full"
        />
        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" {...register('consent')} className="h-4 w-4" />
        Sì, iscrivimi alla vostra newsletter.
      </label>
      {errors.consent && <p className="text-xs text-red-600">{errors.consent.message}</p>}

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
