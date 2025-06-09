const events = [
    { id: '1', title: 'Eventi 1', note: 'luogo: Roma' },
    { id: '2', title: 'Eventi 2', note: 'luogo: Roma' },
    { id: '3', title: 'Eventi 3', note: 'luogo: Roma' },
  ]
  
  export default function EventsSection() {
    return (
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="mb-4 text-4xl font-bold">Eventi</h1>
  
          <p className="mb-10 max-w-3xl text-gray-700">
            Benvenuti nella sezione Eventi di FENAM, uno spazio dinamico che
            riflette il nostro impegno concreto per la costruzione di una società
            più partecipativa e interculturale.
          </p>
  
          <div className="space-y-8">
            {events.map((e) => (
              <article key={e.id} className="border-b pb-6">
                <h3 className="text-2xl font-semibold text-primary">{e.title}</h3>
                <p className="text-sm text-gray-600">{e.note}</p>
                <p className="mt-2 text-gray-700">
                  Molto presto pubblicheremo i nostri eventi.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }
  