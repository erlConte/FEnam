import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'

export default function EventDetail() {
  const { query, isFallback } = useRouter()
  if (isFallback) return <p>Loading…</p>

  // Dati statici dell'evento Adventus Iubilaei 2025
  const evt = {
    slug: 'adventus-iubilaei-2025',
    title: 'Adventus Iubilaei 2025',
    subtitle: 'Forum Interculturale delle Imprese e delle Associazioni',
    date: '1–3 Novembre 2024',
    time: '10:00–24:00',
    location: 'Piazza Vittorio Veneto, Castelnuovo di Porto (RM)',
    excerpt:
      "Un viaggio tra culture, arte e tradizioni, da tutto il mondo! Un evento unico dedicato all’incontro tra comunità internazionali, associazioni e imprese. Ingresso libero.",
    cover: '/img/eventi/iubilei.jpg',
    pdf: '/pdf/Adventus-Iubilaei-2025.pdf',
    description: [
      'La Federazione Unimpresa Lazio e FE.NA.L.C.A. APS, in collaborazione con il comune di Castelnuovo di Porto, vi invitano a partecipare a Adventus Iubilaei 2025, un importante forum interculturale.',
      'Un viaggio tra culture, arte e tradizioni, da tutto il mondo!',
      'Un evento unico dedicato all’incontro tra comunità internazionali, associazioni e imprese.',
      'Ingresso Libero',
    ],
    schedule: [
      {
        date: '1 Novembre 2024',
        time: '10:00–24:00',
        activity: 'Apertura con spettacoli di danza e stand gastronomici.',
      },
      {
        date: '1 Novembre 2024',
        time: '10:30',
        activity: 'Conferenza stampa con Unimpresa, Fenalc, Fenam, Cultural Nexus e autorità',
      },
    ],
    stands: {
      Gastronomici: ['Messico', 'Argentina', 'Perù', 'Ecuador', 'El Salvador', 'Madagascar'],
      Artigianato: ['Argentina', 'Brasile', 'Colombia', 'Cuba', 'Spagna'],
      Turismo: ['Messico', 'Ecuador', 'Perù', 'El Salvador', 'Cuba', 'Brasile', 'Spagna'],
    },
    participants: [
      'Argentina','Brasile','Colombia','Cuba','Ecuador','Eritrea','Etiopia','El Salvador','Kenya','Italia','Madagascar','Messico','Perù','Spagna','Venezuela'
    ],
  }

  if (!evt) return <p>Evento non trovato</p>

  return (
    <>
      <Head>
        <title>{evt.title} — Eventi F.E.N.A.M</title>
        <meta name="description" content={evt.excerpt} />
      </Head>
      <article className="mx-auto max-w-7xl px-6 py-16 lg:flex lg:flex-row-reverse lg:gap-12">
        {/* Immagine a destra su desktop */}
        {evt.cover && (
          <div className="lg:w-1/2 mb-8 lg:mb-0">
            <Image
              src={evt.cover}
              alt={evt.title}
              width={800}
              height={450}
              className="w-full h-auto object-cover rounded-2xl"
            />
          </div>
        )}

        {/* Contenuto evento */}
        <div className="lg:w-1/2">
          <h1 className="text-4xl font-extrabold text-secondary leading-tight mb-4">
            {evt.title}
          </h1>
          <p className="italic text-secondary/80 mb-6">{evt.subtitle}</p>
          <p className="text-secondary mb-6">
            <strong>Quando:</strong> {evt.date} · {evt.time}<br />
            <strong>Dove:</strong> {evt.location}
          </p>

          {evt.description.map((line,i) => (
            <p key={i} className="mb-4 text-secondary">{line}</p>
          ))}

          <h2 className="mt-8 text-2xl font-semibold text-secondary">Programma</h2>
          <ul className="list-disc pl-5 mb-6 text-secondary">
            {evt.schedule.map((item,i) => (
              <li key={i} className="mb-2">
                <strong>{item.date} {item.time}</strong> — {item.activity}
              </li>
            ))}
          </ul>

          <h2 className="mt-8 text-2xl font-semibold text-secondary">Stand</h2>
          {Object.entries(evt.stands).map(([cat, items], idx) => (
            <div key={idx} className="mb-4">
              <h3 className="font-semibold text-secondary">{cat}:</h3>
              <p className="text-secondary">{items.join(', ')}</p>
            </div>
          ))}

          <h2 className="mt-8 text-2xl font-semibold text-secondary">Paesi partecipanti</h2>
          <p className="text-secondary mb-6">{evt.participants.join(', ')}</p>

          <div className="mb-8">
            <a
              href={evt.pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Scarica il comunicato stampa (PDF)
            </a>
          </div>

          <Link href="/eventi" className="text-secondary hover:underline">
            ← Torna agli eventi
          </Link>
        </div>
      </article>
    </>
  )
}
