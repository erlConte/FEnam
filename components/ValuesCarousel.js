import { useState } from 'react'
import Image from 'next/image'

const values = [
  {
    key:'accogliente',
    title: 'Accogliente',
    text:  'Crediamo in una società che abbraccia la diversità…',
  },
  {
    key:'rispetto',
    title: 'Rispetto',
    text:  'Rispettiamo e celebriamo i valori e le tradizioni di ogni cultura…',
  },
  {
    key:'collaborazione',
    title: 'Collaborazione',
    text:  'La collaborazione è la chiave per creare opportunità concrete…',
  },
]

export default function ValuesCarousel() {
  const [active, setActive] = useState(0)

  return (
    <section id="valori" className="relative isolate">
      <Image
        src="/img/valori-bg.jpg"  /* mano sopra mano */
        alt=""
        width={2400}
        height={1000}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />

      {/* card scorrevoli */}
      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-32 lg:grid-cols-3">
        {values.map((v, i) => (
          <button
            key={v.key}
            onClick={() => setActive(i)}
            className={`flex flex-col rounded-3xl bg-cream/90 p-8 text-left shadow transition
              ${active === i ? 'backdrop-blur-lg' : 'opacity-60 hover:opacity-90'}`}
            style={{ backdropFilter:'blur(4px)' }}
          >
            {/* pill */}
            <span className="mb-4 inline-block self-start rounded-full border border-secondary px-3 py-0.5 text-xs">
              I Nostri Valori
            </span>

            <h3 className="mb-4 text-3xl font-bold text-secondary">{v.title}</h3>
            <p className="text-sm text-secondary">{v.text}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
