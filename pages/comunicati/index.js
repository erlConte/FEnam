// pages/comunicati/index.js
import Head from 'next/head'
import { useState } from 'react'
import ComunicatiCard from '../../components/ComunicatiCard'

/* ------------------------------------------------------------------
   Array comunicati – basta aggiungere un oggetto!
-------------------------------------------------------------------*/
export const comunicati = [
  {
    slug : 'calabria-latin-america',
    title: 'La Calabria dialoga con l’America Latina al Vinitaly and the City',
    date : '18 luglio 2025',
    cover: '/img/comunicati/calabria-latin-america.jpg',
  },
  {
    slug: 'ringraziamento-civita',
    title: 'Lettera di ringraziamento – Avv. Civita Di Russo',
    date: '01 luglio 2025',
    cover: '/img/comunicati/ringraziamentodirusso.jpg',
  },
  // { slug:'altro', title:'…', date:'…', cover:'/img/comunicati/…' },
]

export default function Comunicati() {
  const [open, setOpen] = useState(null)

  return (
    <>
      <Head><title>Comunicati stampa | FENAM</title></Head>

      <section className="bg-paper py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="mb-12 text-5xl italic text-secondary">
            Comunicati stampa
          </h1>

          <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-3">
            {comunicati.map((c) => (
              <ComunicatiCard key={c.slug} item={c} onOpen={setOpen} />
            ))}
          </div>

          {/* POP-UP full image */}
          {open && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setOpen(null)}
            >
              <img
                src={open.cover}
                alt=""
                className="max-h-[90vh] w-auto rounded-2xl shadow-2xl"
              />
            </div>
          )}
        </div>
      </section>
    </>
  )
}
