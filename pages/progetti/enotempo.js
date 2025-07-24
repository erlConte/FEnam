// pages/progetti/enotempo.js
import { useState, useEffect } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarPlus, Flag } from 'lucide-react'

/* ------------------------------------------------------------- */
/* IMMAGINI CAROSELLO (8 slide in /public/img/progetti/enotempo/) */
const slides = Array.from({ length: 8 }, (_, i) =>
  `/img/progetti/enotempo/slide-${i + 1}.jpg`
)

/* DATI EVENTO */
const evento = {
  titolo: 'ENOTEMPO · Wine & Culture Experience',
  luogo: 'Roma – Auditorium (TBD)',
  startISO: '2025-10-03T19:00:00',
  endISO:   '2025-10-03T23:00:00',
}

/* TESTI -------------------------------------------------------- */
const testi = {
  it: {
    chi: `ENOTEMPO è molto più di un progetto: un’esperienza che nasce
dall’incontro fra vino, cultura e narrazione. Creiamo eventi multisensoriali
che connettono le persone attraverso sapori, storie e territori.`,
  },
  es: {
    chi: `ENOTEMPO es mucho más que un proyecto: es una vivencia que nace de
la fusión entre vino, cultura y narrativa. Diseñamos catas multisensoriales
que despiertan los sentidos y conectan a las personas.`,
    mision: `Misión — Diseñamos experiencias multisensoriales donde el arte
del maridaje se entrelaza con la cultura, la naturaleza y las personas.`,
    vision: `Visión — Consolidar una red de eventos en destinos emblemáticos
del mundo, donde los productos de excelencia sean puentes entre culturas y
sentidos.`,
    valores: ['Autenticidad', 'Elegancia', 'Calidad', 'Cultura', 'Conexión'],
  },
}

/* MENU --------------------------------------------------------- */
const menu = {
  it: [
    {
      titolo: 'PALTA – antipasto',
      descr:
        'Pane della casa, avocado delle Ande, salsa escabeche, pomodoro, pinoli, basilico, sale di Maras.',
    },
    {
      titolo: 'AJÍ SECO – primo',
      descr:
        'Salsa di ají seco, trota andina, huacatay & mais chullpi, quinoa, mousse di avocado.',
    },
    {
      titolo: 'CHINCHO & HUACATAY – secondo',
      descr:
        'Olluco, patata dolce, fave, choclo, lomo di manzo marinato alle erbe andine.',
    },
    {
      titolo: 'MAÍZ MORADO – dessert',
      descr:
        'Purea di mais viola, ananas & fragole al forno, cannella, meringa, pistacchio.',
    },
  ],
  es: [
    {
      titolo: 'PALTA – entrante',
      descr:
        'Pan de la casa, palta andina, salsa escabeche, tomate, piñones, albahaca, sal de Maras.',
    },
    {
      titolo: 'AJÍ SECO – primero',
      descr:
        'Salsa de ají seco, trucha andina, huacatay & maíz chullpi, quinoa, mousse de palta.',
    },
    {
      titolo: 'CHINCHO & HUACATAY – segundo',
      descr:
        'Olluco, camote, habas, choclo, lomo de res macerado en hierbas andinas.',
    },
    {
      titolo: 'MAÍZ MORADO – postre',
      descr:
        'Puré de maíz morado, piña & fresas al horno, canela, merengue, pistacho.',
    },
  ],
}

/* HELPER ICS ---------------------------------------------------- */
function makeIcsBlob() {
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (d) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
      d.getUTCDate()
    )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`

  const start = new Date(evento.startISO)
  const end   = new Date(evento.endISO)

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${evento.titolo}
DTSTART:${fmt(start)}
DTEND:${fmt(end)}
LOCATION:${evento.luogo}
END:VEVENT
END:VCALENDAR`

  return new Blob([ics], { type: 'text/calendar' })
}

/* COMPONENTE --------------------------------------------------- */
export default function EnotempoPage() {
  /* carosello */
  const [idx, setIdx] = useState(0)
  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length)
  const next = () => setIdx((i) => (i + 1) % slides.length)

  /* autoplay */
  useEffect(() => {
    const t = setInterval(next, 6500)
    return () => clearInterval(t)
  }, [])

  /* lingua */
  const [lang, setLang] = useState('it')
  const t = testi[lang]

  /* ics url */
  const [icsUrl, setIcsUrl] = useState(null)
  useEffect(() => {
    const blob = makeIcsBlob()
    const url = URL.createObjectURL(blob)
    setIcsUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [])

  /* data e orario */
  const start = new Date(evento.startISO)
  const end   = new Date(evento.endISO)
  const dateFmt = start.toLocaleDateString(
    lang === 'it' ? 'it-IT' : 'es-ES',
    { day: 'numeric', month: 'long', year: 'numeric' }
  )
  const timeFmt = `${start.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })} – ${end.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })}`

  return (
    <>
      <Head>
        <title>{evento.titolo} — Progetti FENAM</title>
        <meta
          name="description"
          content="Esperienza multisensoriale ENOTEMPO: vino, cultura, territorio."
        />
      </Head>

      <article className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        {/* CAROSELLO */}
        <div className="relative aspect-video overflow-hidden rounded-2xl shadow-lg">
          <Image
            src={slides[idx]}
            alt={`Slide ${idx + 1}`}
            fill
            className="object-cover"
            priority
          />
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur-md shadow"
            aria-label="slide precedente"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur-md shadow"
            aria-label="slide successiva"
          >
            <ChevronRight />
          </button>
        </div>

        {/* HEADER + CTA */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl text-secondary">
              {evento.titolo}
            </h1>
            <p className="mt-1 italic text-secondary/80">
              {dateFmt} · {timeFmt} · {evento.luogo}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'it' ? 'es' : 'it')}
              className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-primary/10"
            >
              <Flag className="h-4 w-4" />
              {lang === 'it' ? 'ES' : 'IT'}
            </button>

            {icsUrl && (
              <a
                href={icsUrl}
                download="enotempo.ics"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white shadow hover:bg-primary/90"
              >
                <CalendarPlus size={18} />{' '}
                {lang === 'it' ? 'Aggiungi al calendario' : 'Añadir al calendario'}
              </a>
            )}
          </div>
        </div>

        {/* PARAGRAFI */}
        <section className="space-y-10 leading-relaxed text-secondary">
          <div className="space-y-4">
            <h2 className="text-2xl italic font-semibold">
              {lang === 'it' ? 'Chi siamo' : 'Quiénes somos'}
            </h2>
            <p className="prose max-w-none" dangerouslySetInnerHTML={{ __html: t.chi }} />
          </div>

          {lang === 'es' && (
            <div className="space-y-8">
              <p className="prose" dangerouslySetInnerHTML={{ __html: t.mision }} />
              <p className="prose" dangerouslySetInnerHTML={{ __html: t.vision }} />

              <div>
                <h3 className="mb-2 font-semibold">Valores</h3>
                <ul className="list-disc space-y-1 pl-6">
                  {t.valores.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* MENU */}
        <div className="rounded-xl bg-[#faf7f1] p-8 shadow-inner space-y-6">
          <h2 className="mb-2 text-2xl italic font-semibold">
            Menú “Tullpukuna” · Gluten-free
          </h2>

          <ul className="space-y-4">
            {menu[lang].map((p, i) => (
              <li key={i} className="space-y-1">
                <p className="font-semibold">{p.titolo}</p>
                <p className="text-secondary/90">{p.descr}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 font-medium">
            Ticket: 80 € ·{' '}
            {lang === 'it'
              ? 'Vini italiani d’eccellenza in abbinamento'
              : 'Maridaje con vinos italianos de excelencia'}
          </p>
        </div>

        {/* BACK */}
        <div className="pt-10">
          <Link href="/progetti" className="text-primary hover:underline">
            ← {lang === 'it' ? 'Torna ai progetti' : 'Volver a proyectos'}
          </Link>
        </div>
      </article>
    </>
  )
}
