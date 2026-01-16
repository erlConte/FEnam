// pages/comunicati/index.js
import Head from 'next/head'
import { useState } from 'react'
import ComunicatiCard from '../../components/ComunicatiCard'

export const comunicati = [
  {
    slug: 'calabria-latin-america',
    title: "La Calabria dialoga con l'America Latina al Vinitaly and the City",
    date: '18 luglio 2025',
    cover: '/img/comunicati/calabria-latin-america.jpg',
  },
  {
    slug: 'ringraziamento-civita',
    title: 'Lettera di ringraziamento – Avv. Civita Di Russo',
    date: '01 luglio 2025',
    cover: '/img/comunicati/ringraziamentodirusso.jpg',
  },
]

export default function Comunicati() {
  const [open, setOpen] = useState(null)

  const safeItems = comunicati.filter((c) => c?.slug && c?.title && c?.date && c?.cover)

  return (
    <>
      <Head>
        <title>Comunicati stampa | FENAM</title>
      </Head>

      <section className="bg-paper py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="mb-12 text-5xl italic text-secondary">Comunicati stampa</h1>

          <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-3">
            {safeItems.map((c) => (
              <ComunicatiCard key={c.slug} item={c} onOpen={setOpen} />
            ))}
          </div>

          {open && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setOpen(null)}
              role="dialog"
              aria-modal="true"
            >
              <img
                src={open.cover}
                alt={open.title || 'Comunicato stampa'}
                className="max-h-[90vh] w-auto rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
