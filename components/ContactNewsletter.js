// components/ContactNewsletter.js
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Card from './ui/Card'
import NewsletterForm from './NewsletterForm'

// schema di validazione per il form di contatto
const contactSchema = z.object({
  nome:      z.string().min(1, 'Nome obbligatorio'),
  cognome:   z.string().min(1, 'Cognome obbligatorio'),
  telefono:  z.string().min(5, 'Telefono non valido'),
  email:     z.string().email('Email non valida'),
  messaggio: z.string().min(10, 'Messaggio troppo corto'),
})

export default function ContactNewsletter() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({ resolver: zodResolver(contactSchema) })

  async function onSubmit(data) {
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success('Messaggio inviato! Ti risponderemo presto.')
        reset()
      } else {
        // mostriamo il messaggio user-friendly ricevuto dal server
        toast.error(json.message || json.error || 'Errore durante l\'invio')
      }
    } catch (err) {
      toast.error('Errore di rete, riprova più tardi')
    }
  }

  return (
    <section id="contatti" className="bg-night py-28 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Heading */}
          <h2 className="text-4xl font-bold leading-tight">
            Compila il modulo<br/> e ti contatteremo!
          </h2>

          {/* Form contatti */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 lg:row-span-2 lg:col-start-2"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <input
                  {...register('nome')}
                  placeholder="Nome *"
                  className="input-field"
                />
                {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome.message}</p>}
              </div>
              <div>
                <input
                  {...register('cognome')}
                  placeholder="Cognome *"
                  className="input-field"
                />
                {errors.cognome && <p className="mt-1 text-xs text-red-600">{errors.cognome.message}</p>}
              </div>
              <div className="md:col-span-2">
                <input
                  {...register('telefono')}
                  placeholder="Telefono *"
                  className="input-field"
                />
                {errors.telefono && <p className="mt-1 text-xs text-red-600">{errors.telefono.message}</p>}
              </div>
              <div className="md:col-span-2">
                <input
                  {...register('email')}
                  placeholder="Email *"
                  className="input-field"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>
              <div className="md:col-span-2">
                <textarea
                  {...register('messaggio')}
                  placeholder="Messaggio *"
                  className="input-field"
                />
                {errors.messaggio && <p className="mt-1 text-xs text-red-600">{errors.messaggio.message}</p>}
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full border px-8 py-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Invio…' : 'Inviare'}
            </button>
          </form>

          {/* Contact Card desktop */}
          <Card className="hidden lg:block bg-paper text-night lg:row-start-2 lg:col-start-1 max-w-sm">
            <h3 className="text-2xl font-semibold mb-2">
              Contattaci per richieste <br/>o collaborazioni
            </h3>
            <p>info@fenam.it</p>
            <p>Via del Plebiscito 112 Roma - 00186</p>
          </Card>

          {/* Contact Card mobile */}
          <Card className="lg:hidden bg-paper text-night">
            <h3 className="text-2xl font-semibold mb-2">
              Contattaci per richieste o collaborazioni
            </h3>
            <p>info@fenam.it</p>
            <p>Via del Plebiscito 112 Roma - 00186</p>
          </Card>

          {/* Newsletter */}
          <div className="lg:col-span-2">
            <h3 className="mt-24 text-3xl font-bold">
              Unisciti alla newsletter di F.E.N.A.M
            </h3>
            <p className="mt-2 text-sm">
              Sii il primo a ricevere le ultime notizie e aggiornamenti.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </div>
    </section>
  )
}
