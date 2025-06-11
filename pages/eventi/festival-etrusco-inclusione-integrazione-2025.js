import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'

export default function EventDetail() {
  const { isFallback } = useRouter()
  if (isFallback) return <p>Loading…</p>

  // Dati statici dell'evento Festival Etrusco
  const evt = {
    slug: 'festival-etrusco-inclusione-integrazione-2025',
    title: "4º FESTIVAL ETRUSCO dell'INCLUSIONE e dell'INTEGRAZIONE",
    subtitle: 'Regione Lazio – Per Terra e Per Mare',
    date: '20–23 Giugno 2025',
    time: '',
    location: 'Cerveteri, Piazza Santa Maria – Sala Ruspoli',
    excerpt: 'Ingresso gratuito: arte, convegni, spettacoli, multicultura e tanto altro a Cerveteri.',
    cover: '/img/eventi/etruschi.jpg',
    pdf: null,
    description: [
      "4º FESTIVAL ETRUSCO dell'INCLUSIONE e dell'INTEGRAZIONE",
      'Regione Lazio – Per Terra e Per Mare',
      'Ingresso gratuito',
      'Art + Festival: scopri tutti gli eventi a Cerveteri, Cerenova e Valcanneto.',
      'www.art-festival.it – info@art-festival.it',
    ],
    schedule: [
      {
        date: 'Giovedì 20 Giugno 2025',
        activity: 'Mostra d’arte, aperitivo e live music; spettacolo teatrale.',
      },
      {
        date: 'Venerdì 21 Giugno 2025',
        activity: 'Convegni e conferenze; spettacolo teatrale.',
      },
      {
        date: 'Sabato 22 Giugno 2025',
        activity:
          'Grande festa multiculturale con ambasciate e consolati; street food; cocktail tropicali; attività per bambini; sfilata folklorica; esibizioni musicali; DJ set.',
      },
      {
        date: 'Domenica 23 Giugno 2025',
        activity: 'Tavola rotonda istituzionale; aperitivo e live music; concerto finale.',
      },
    ],
  }

  return (
    <>
      <Head>
        <title>{evt.title} — Eventi F.E.N.A.M</title>
        <meta name="description" content={evt.excerpt} />
      </Head>
      <article className="mx-auto max-w-7xl px-6 py-16 lg:flex lg:flex-row-reverse lg:gap-12">
        {/* Immagine a destra su desktop */}
        <div className="lg:w-1/2 mb-8 lg:mb-0">
          <Image
            src={evt.cover}
            alt={evt.title}
            width={800}
            height={450}
            className="w-full h-auto object-cover rounded-2xl"
          />
        </div>

        {/* Contenuto evento */}
        <div className="lg:w-1/2">
          <h1 className="text-4xl font-extrabold text-secondary leading-tight mb-4">
            {evt.title}
          </h1>
          <p className="italic text-secondary/80 mb-6">{evt.subtitle}</p>
          <p className="text-secondary mb-6">
            <strong>Date:</strong> {evt.date}<br />
            <strong>Luogo:</strong> {evt.location}
          </p>

          {evt.description.map((line, i) => (
            <p key={i} className="mb-4 text-secondary">
              {line}
            </p>
          ))}

          <h2 className="mt-8 text-2xl font-semibold text-secondary">Programma</h2>
          <ul className="list-disc pl-5 mb-6 text-secondary">
            {evt.schedule.map((item, i) => (
              <li key={i} className="mb-2">
                <strong>{item.date}:</strong> {item.activity}
              </li>
            ))}
          </ul>

          <Link href="/eventi" className="text-secondary hover:underline">
            ← Torna agli eventi
          </Link>
        </div>
      </article>
    </>
  )
}
