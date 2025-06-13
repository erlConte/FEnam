import Head from 'next/head'
import EventCard from '../../components/EventCard'

// Dati eventi in-file come per il blog
export const events = [
  {
    slug: 'adventus-iubilaei-2025',
    title: 'Adventus Iubilaei 2025',
    subtitle: 'Forum Interculturale delle Imprese e delle Associazioni',
    date: '1–3 Novembre 2024',
    time: '10:00–24:00',
    location: 'Piazza Vittorio Veneto, Castelnuovo di Porto (RM)',
    excerpt: 'Un viaggio tra culture, arte e tradizioni con stand gastronomici e artigianali. Ingresso libero.',
    cover: '/img/eventi/iubilei.jpg',
    pdf: '/pdf/Adventus-Iubilaei-2025.pdf',
  },
  {
    slug: 'festival-etrusco-inclusione-integrazione-2025',
    title: "4º FESTIVAL ETRUSCO dell'INCLUSIONE e dell'INTEGRAZIONE", 
    subtitle: 'Regione Lazio per Terra e per Mare',
    date: '20–23 Giugno 2024',
    time: '',
    location: 'Cerveteri, Piazza Santa Maria, Sala Ruspoli',
    excerpt: 'Ingresso gratuito: arte, conferenze, spettacoli, street food e attività per tutti i giorni.',
    cover: '/img/eventi/etruschi.jpg',
    pdf: null,
  },
  {
    slug: 'fu-turismo-roma-futuro-ospitalita-extralberghiera',
    title: 'FU TURISMO: Roma e il Futuro dell’Ospitalità Extralberghiera',
    subtitle: 'Auditorium Antonianum, Roma',
    date: '21 Gennaio 2024',
    time: '09:00–18:00',
    location: 'Auditorium Antonianum, Roma',
    excerpt:
      '“FU TURISMO” è un laboratorio di idee promosso da UNIMPRESA LAZIO dove istituzioni, imprenditori e professionisti si confrontano per il futuro del turismo extralberghiero. Ingresso libero.',
    cover: '/img/eventi/futurismo.jpg',
    pdf: null,
  },
]

export default function Eventi() {
  return (
    <>
      <Head>
        <title>Eventi | F.E.N.A.M</title>
      </Head>
      <section className="bg-paper py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="mb-12 text-5xl italic text-secondary">Eventi</h1>
          <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-3">
            {events.map(evt => (
              <EventCard key={evt.slug} evt={evt} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
