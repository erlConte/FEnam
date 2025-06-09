// components/AffiliazioneForm.js
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'

const schema = z.object({
  nome:     z.string().min(2, 'Obbligatorio'),
  cognome:  z.string().min(2, 'Obbligatorio'),
  email:    z.string().email('Email non valida'),
  telefono: z.string().min(5, 'Obbligatorio'),
  privacy:  z.literal(true, { errorMap: () => ({ message: 'Richiesto' }) }),
})

export default function AffiliazioneForm() {
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(values) {
    setLoading(true)
    const res = await fetch('/api/affiliazione', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else if (data.ok) {
      toast.success('Richiesta inviata!')
      reset()
    } else toast.error(data.error || 'Errore')
    setLoading(false)
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="form-col space-y-6 rounded-3xl bg-[#8fd1d2] p-8 text-secondary"
    >
      <h2 className="text-3xl font-bold">Carta di Affiliazione</h2>

      {/* campi base */}
      {['nome', 'cognome', 'email', 'telefono'].map((field) => (
        <div key={field}>
          <label className="mb-1 block text-sm capitalize">
            {field}{field === 'email' && ' *'}
          </label>
          <input
            {...register(field)}
            type={field === 'email' ? 'email' : 'text'}
            className="input-field"
          />
          {errors[field] && (
            <p className="mt-1 text-xs text-red-600">{errors[field].message}</p>
          )}
        </div>
      ))}

      {/* checkbox privacy */}
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" {...register('privacy')} className="h-4 w-4" />
        Accetto termini &amp; privacy
      </label>
      {errors.privacy && (
        <p className="mt-1 text-xs text-red-600">{errors.privacy.message}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-secondary px-6 py-3 font-semibold text-cream shadow disabled:opacity-60"
      >
        {loading ? 'Invio…' : 'Acquista ora'}
      </button>

      <p className="text-center text-xs">Carta di abbonamento €85/anno</p>
    </form>
  )
}
