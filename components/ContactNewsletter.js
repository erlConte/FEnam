import NewsletterForm from './NewsletterForm'

export default function ContactNewsletter() {
  return (
    <section id="contatti" className="bg-night py-28 text-white">
      <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-2">
        {/* — Titolo a sinistra — */}
        <h2 className="text-4xl font-bold leading-tight">
          Compila il modulo<br /> e ti contatteremo!
        </h2>

        {/* — Form contatti placeholder — */}
        <form className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <input placeholder="Nome"      className="input-field" />
            <input placeholder="Cognome"   className="input-field" />
            <input placeholder="Telefono"  className="input-field md:col-span-2" />
            <input placeholder="Email *"   className="input-field md:col-span-2" />
          </div>
          <textarea
            placeholder="Messaggio"
            rows={3}
            className="input-field h-32"
          />
          <button className="rounded-full border px-8 py-2">Inviare</button>
        </form>

        {/* — Newsletter vera — */}
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
    </section>
  )
}
