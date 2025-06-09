import Image from 'next/image'
import { RotateCcw } from 'lucide-react'

const sectors = [
  {
    slug: 'food-moda',
    title: 'Food & Moda',
    pill: 'Food & Moda • ',
    img: '/img/settori/food-moda.jpg',               // 1200×800 circa
    paragraphs: [
      'Promuoviamo la cultura culinaria delle diverse comunità, organizzando eventi gastronomici e mercati internazionali.',
      'Sosteniamo designer e stilisti di origine straniera, facilitando la loro partecipazione a sfilate e fiere di moda.',
    ],
  },
  {
    slug: 'cultura-sociale',
    title: 'Cultura & Sociale',
    pill: 'Cultura & Sociale • ',
    img: '/img/settori/cultura-sociale.jpg',
    paragraphs: [
      'Organizziamo iniziative solidali, festival artistici e progetti di inclusione per rafforzare il dialogo interculturale.',
      'Collaboriamo con enti del terzo settore per promuovere coesione, volontariato e cittadinanza attiva.',
    ],
  },
  {
    slug: 'turismo-education',
    title: 'Turismo & Education',
    pill: 'Turismo & Education • ',
    img: '/img/settori/turismo-education.jpg',
    paragraphs: [
      'Offriamo supporto e assistenza: promuoviamo il turismo culturale e responsabile, creando pacchetti che valorizzino tradizioni e patrimonio.',
      "Forniamo programmi educativi e formativi per favorire l'apprendimento continuo e lo sviluppo delle competenze professionali.",
    ],
  },
]

function Pill({ text }) {
  return (
    <div className="relative flex items-center gap-2">
      <div className="relative overflow-hidden rounded-full border border-secondary px-4 py-1 text-sm">
        {/* doppio testo → effetto loop; width 200% */}
        <span className="inline-block animate-marquee whitespace-nowrap">
          {text.repeat(6)}
        </span>
      </div>

      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-secondary bg-primary/20 text-secondary">
        <RotateCcw size={16} />
      </span>
    </div>
  )
}

export default function SectorsShowcase() {
  return (
    <section id="settori" className="bg-[#e7e9e9] py-20">
      <div className="mx-auto max-w-7xl space-y-16 px-6">
        <h2 className="text-lg font-semibold tracking-wide text-secondary">
          • I Nostri Settori
        </h2>

        {sectors.map((s, idx) => (
          <div
            key={s.slug}
            className="rounded-3xl bg-[#fff9e9] p-10 md:p-14"
          >
            {/* pill */}
            <Pill text={s.pill} />

            {/* content row */}
            <div className="mt-10 grid gap-10 md:grid-cols-2 md:items-center">
              <div>
                {s.paragraphs.map((p, i) => (
                  <p key={i} className="mb-6 text-lg text-secondary">
                    {p}
                  </p>
                ))}
              </div>

              <Image
                src={s.img}
                alt=""
                width={900}
                height={600}
                className="rounded-2xl object-cover"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
