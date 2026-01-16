// pages/progetti/enotempo.js
import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarPlus, Flag, Phone } from 'lucide-react'

/* --------------- SLIDES ---------------- */
const slides = Array.from({ length: 8 }, (_, i) => `/img/progetti/enotempo/slide-${i + 1}.jpg`)

/* --------------- DATI EVENTO ----------- */
const evento = {
  titolo: 'ENOTEMPO · Wine & Culture Experience',
  luogo: 'Ristorante Tullpukuna, Piazza Dante 5, 00185 Roma (RM)',
  startISO: '2025-07-31T20:00:00',
  endISO: '2025-07-31T23:30:00',
}

/* --------------- CONTATTO -------------- */
const contatto = {
  tel: '+39 351 313 1624',
  telLink: 'tel:+393513131624',
}

/* --------------- TESTI ----------------- */
const testi = {
  it: {
    chi: `ENOTEMPO è molto più di un progetto: un’esperienza multisensoriale nata dall’incontro fra <strong>vino</strong>, <strong>cultura</strong> e <strong>narrazione</strong>. Con i nostri format connettiamo le persone attraverso degustazioni, storie e territori.`,
  },
  es: {
    chi: `ENOTEMPO es mucho más que un proyecto: es una vivencia multisensorial donde <strong>vino</strong>, <strong>cultura</strong> y <strong>narrativa</strong> se encuentran. Creamos catas que despiertan los sentidos y conectan a las personas.`,
    mision: `<strong>Misión</strong> — Diseñamos experiencias donde el arte del maridaje se entrelaza con la cultura, la naturaleza y las personas.`,
    vision: `<strong>Visión</strong> — Consolidar una red de eventos en destinos emblemáticos del mundo, donde los productos de excelencia sean puentes entre culturas y sensaciones.`,
    valores: ['Autenticidad', 'Elegancia', 'Calidad', 'Cultura', 'Conexión'],
  },
}

/* --------------- MENU COMPLETO --------- */
const menu = {
  it: [
    {
      titolo: 'PALTA – antipasto',
      descr: `
Pan della casa / Palta / Salsa escabeche / Pomodoro / Pinoli / Basilico / Sale di Maras<br/>
<em>Un antipasto che unisce tradizione peruviana e tocchi mediterranei.</em><br/><br/>
<strong>Palta</strong>: l'avocado, chiamato così in Perù, è coltivato nelle valli andine, ricco e cremoso, simbolo di equilibrio naturale.<br/>
<strong>Salsa escabeche</strong>: una salsa agrodolce di origine coloniale, a base di cipolla marinata in aceto e spezie, che conferisce profondità al piatto.<br/>
<strong>Pomodoro &amp; basilico</strong>: un omaggio all'ingrediente italiano, per un ponte di sapori tra mondi lontani.<br/>
<strong>Pinoli</strong>: croccantezza delicata, che armonizza la cremosità dell'avocado.<br/>
<strong>Sale di Maras</strong>: raccolto a mano dalle antiche saline Inca a 3.000 metri, nella Valle Sacra, ha un sapore minerale e prezioso.`,
    },
    {
      titolo: 'AJÍ SECO – primo piatto',
      descr: `
Salsa di ají seco / Trota / Huacatay e mais chullpi / Quinoa / Sale affumicato / Mousse di avocado<br/>
<em>Un piatto che racconta le Ande in ogni sfumatura.</em><br/><br/>
<strong>Ají seco</strong>: peperoncino peruviano essiccato al sole, dal gusto profondo e leggermente affumicato.<br/>
<strong>Trota</strong>: allevata in acque cristalline dell'altopiano andino, delicata e saporita.<br/>
<strong>Huacatay</strong>: chiamato anche "mentuccia nera", erba aromatica peruviana dal profumo intenso e inconfondibile.<br/>
<strong>Mais chullpi</strong>: mais croccante originario della regione di Cusco, tostato per una nota fragrante.<br/>
<strong>Quinoa</strong>: il "grano degli Inca", nutriente e ricco di storia, proveniente dagli altopiani.<br/>
<strong>Sale affumicato &amp; mousse di palta</strong>: un abbinamento moderno che valorizza gli ingredienti ancestrali.`,
    },
    {
      titolo: 'CHINCHO E HUACATAY – secondo piatto',
      descr: `
Olluco / Patata dolce / Patata andina / Carota / Fave / Choclo / Lomo di manzo / Macerato alle erbe andine<br/>
<em>Un piatto che celebra la terra e le sue radici, nella forma più sincera.</em><br/><br/>
<strong>Olluco</strong>: tubero andino ricco d'acqua, dalla consistenza unica e dal gusto delicato.<br/>
<strong>Camote (patata dolce) e papa</strong>: varietà locali che offrono dolcezza e struttura, fondamentali nella cucina peruviana.<br/>
<strong>Carota, fave e choclo</strong>: legumi e verdure autoctone, colorati e nutrienti. Il choclo è il mais gigante delle Ande, dal sapore dolce e granuloso.<br/>
<strong>Lomo di manzo</strong>: taglio nobile, marinato in chincho e huacatay, due erbe aromatiche andine che conferiscono freschezza, balsamicità e identità.`,
    },
    {
      titolo: 'MAÍZ MORADO – dolce',
      descr: `
Purè di mais morado / Ananas / Fragole al forno / Cannella / Meringa / Pistacchio<br/>
<em>Un dessert sorprendente, che unisce dolcezza ancestrale e tecnica contemporanea.</em><br/><br/>
<strong>Maíz morado</strong>: varietà di mais viola scuro, coltivata sulle Ande, ricchissima di antociani, usata per preparare la tradizionale chicha morada e dolci intensi.<br/>
<strong>Ananas e fragole al forno</strong>: frutti tropicali cotti lentamente per esaltarne la dolcezza naturale.<br/>
<strong>Cannella</strong>: nota calda e avvolgente, presente in molti dessert della tradizione peruviana.<br/>
<strong>Meringa &amp; pistacchio</strong>: consistenza leggera e contrasto croccante, per un finale elegante e raffinato.`,
    },
  ],
  es: [
    {
      titulo: 'PALTA – entrante',
      descr: `
Pan de la casa / Palta / Salsa escabeche / Tomate / Piñones / Albahaca / Sal de Maras<br/>
<em>Fusión de tradición peruana y matices mediterráneos.</em><br/><br/>
<strong>Palta</strong>: aguacate andino cremoso.<br/>
<strong>Salsa escabeche</strong>: cebolla marinada agridulce.<br/>
<strong>Tomate &amp; albahaca</strong>: puente italo-peruano.<br/>
<strong>Piñones</strong>: toque crujiente.<br/>
<strong>Sal de Maras</strong>: cristales milenarios de los Andes.`,
    },
    {
      titulo: 'AJÍ SECO – primero',
      descr: `
Salsa de ají seco / Trucha andina / Huacatay &amp; maíz chullpi / Quinoa / Mousse de palta<br/>
<em>Los Andes en cada matiz.</em><br/><br/>
<strong>Ají seco</strong>: picante ahumado natural.<br/>
<strong>Trucha</strong>: crianza de altura, sabor delicado.<br/>
<strong>Huacatay</strong>: menta negra aromática.<br/>
<strong>Maíz chullpi</strong>: tostado y fragante.<br/>
<strong>Quinoa</strong>: "grano de los Incas".<br/>
<strong>Mousse de palta</strong>: cremosidad contemporánea.`,
    },
    {
      titulo: 'CHINCHO & HUACATAY – segundo',
      descr: `
Olluco / Camote / Papas andinas / Zanahoria / Habas / Choclo / Lomo de res macerado<br/>
<em>Celebración de la tierra y sus raíces.</em><br/><br/>
<strong>Olluco</strong>: tubérculo andino acuoso y delicado.<br/>
<strong>Camote &amp; papas</strong>: dulzor y estructura.<br/>
<strong>Choclo</strong>: maíz gigante dulce.<br/>
<strong>Lomo de res</strong>: macerado en chincho y huacatay, hierbas balsámicas.`,
    },
    {
      titulo: 'MAÍZ MORADO – postre',
      descr: `
Puré de maíz morado / Piña &amp; fresas al horno / Canela / Merengue / Pistacho<br/>
<em>Dulzura ancestral y técnica contemporánea.</em><br/><br/>
<strong>Maíz morado</strong>: rico en antocianinas.<br/>
<strong>Fruta al horno</strong>: caramelización natural.<br/>
<strong>Canela</strong>: nota cálida clásica.<br/>
<strong>Merengue &amp; pistacho</strong>: ligereza y crocante final.`,
    },
  ],
}

/* --------------- ICS ------------------- */
function escapeIcs(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}
function toIcsDateUTC(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}
function buildIcs() {
  const start = new Date(evento.startISO)
  const end = new Date(evento.endISO)
  const uid = `enotempo-${start.getTime()}@fenam.it`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FENAM//ENOTEMPO//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDateUTC(new Date())}`,
    `SUMMARY:${escapeIcs(evento.titolo)}`,
    `DTSTART:${toIcsDateUTC(start)}`,
    `DTEND:${toIcsDateUTC(end)}`,
    `LOCATION:${escapeIcs(evento.luogo)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/* =============== COMPONENTE =============== */
export default function EnotempoPage() {
  const [idx, setIdx] = useState(0)
  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length)
  const next = () => setIdx((i) => (i + 1) % slides.length)

  useEffect(() => {
    const t = setInterval(next, 6500)
    return () => clearInterval(t)
  }, [])

  const [lang, setLang] = useState('it')
  const t = testi[lang]

  // ICS URL: creato SOLO lato client (in produzione evita sorprese)
  const [icsUrl, setIcsUrl] = useState(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ics = buildIcs()
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    setIcsUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [])

  const start = useMemo(() => new Date(evento.startISO), [])
  const end = useMemo(() => new Date(evento.endISO), [])

  const dateFmt = start.toLocaleDateString(lang === 'it' ? 'it-IT' : 'es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const timeFmt = `${start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`

  return (
    <>
      <Head>
        <title>{evento.titolo} — Progetti FENAM</title>
        <meta name="description" content="Cena multisensoriale: menù Tullpukuna (gluten free) + vini italiani d'eccellenza." />
      </Head>

      <article className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        {/* CAROSELLO */}
        <div className="relative aspect-video overflow-hidden rounded-2xl shadow-lg">
          <Image src={slides[idx]} alt={`Slide ${idx + 1}`} fill className="object-cover" priority />
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

        {/* HEADER & CTA */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-secondary">{evento.titolo}</h1>
            <p className="mt-1 italic text-secondary/80">
              {dateFmt} · {timeFmt} · {evento.luogo}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'it' ? 'es' : 'it')}
              className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-primary/10"
              aria-label="cambia lingua"
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
                <CalendarPlus size={18} />
                {lang === 'it' ? 'Aggiungi al calendario' : 'Añadir al calendario'}
              </a>
            )}
          </div>
        </div>

        {/* POSTI LIMITATI + INFO */}
        <div className="rounded-lg bg-primary/10 p-4 text-center font-semibold text-primary">
          {lang === 'it' ? '🎉 Posti limitati — affrettati a prenotare!' : '🎉 Plazas limitadas — ¡reserva cuanto antes!'}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 rounded-xl border p-6 shadow-md">
          <p className="flex items-center gap-2 text-lg font-medium text-secondary">
            <Phone className="h-5 w-5 flex-shrink-0" />
            {lang === 'it' ? 'Info & prenotazioni' : 'Información & reservas'}:&nbsp;
            <a href={contatto.telLink} className="underline hover:text-primary">
              {contatto.tel}
            </a>
          </p>
          <p className="text-sm text-secondary/70">
            {lang === 'it'
              ? '📸 Foto professionali in digitale in OMAGGIO · 🍾 Sorteggio bottiglia "miglior metodo classico"'
              : '📸 Fotos profesionales digitales GRATIS · 🍾 Sorteo de botella "mejor método clásico"'}
          </p>
        </div>

        {/* INTRO + (ES) MISSION/VISION */}
        <section className="space-y-8 leading-relaxed text-secondary">
          <p className="prose max-w-none" dangerouslySetInnerHTML={{ __html: t.chi }} />

          {lang === 'es' && (
            <div className="space-y-8">
              <p className="prose" dangerouslySetInnerHTML={{ __html: testi.es.mision }} />
              <p className="prose" dangerouslySetInnerHTML={{ __html: testi.es.vision }} />
              <div>
                <h3 className="mb-2 font-semibold">Valores</h3>
                <ul className="list-disc pl-6 space-y-1">
                  {testi.es.valores.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>

        {/* MENU CARD */}
        <div className="rounded-xl bg-[#faf7f1] p-8 shadow-inner space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl italic font-semibold">Menù "Tullpukuna" · Gluten Free</h2>
            <p className="text-secondary/80">{lang === 'it' ? 'Opzione anche vegetariana.' : 'Disponible opción vegetariana.'}</p>
            <p className="text-secondary/80 italic">
              {lang === 'it'
                ? "In celebrazione della Giornata Mondiale dell'Avocado — 31 luglio 2025."
                : 'En celebración del Día Mundial del Aguacate — 31 de julio de 2025.'}
            </p>
          </div>

          <ul className="space-y-10">
            {menu[lang].map((p, i) => (
              <li key={i} className="space-y-2">
                <p className="font-semibold text-lg">{p.titolo || p.titulo}</p>
                <div className="text-secondary/90 leading-relaxed prose max-w-none">
                  <span dangerouslySetInnerHTML={{ __html: p.descr }} />
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 font-medium">
            {lang === 'it'
              ? 'Biglietto: 80 € · Vini nazionali di eccellenza Made in Italy.'
              : 'Entrada: 80 € · Vinos italianos de excelencia (Made in Italy).'}
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
