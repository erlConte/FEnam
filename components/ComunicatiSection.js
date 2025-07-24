// components/ComunicatiSection.js
import ComunicatiCard from './ComunicatiCard'
import { useState } from 'react'

export default function ComunicatiSection({ items }) {
  const [open, setOpen] = useState(null)         // item aperto

  return (
    <section className="bg-paper py-24" id="comunicati">
      <div className="mx-auto max-w-7xl px-6">
        <header className="mb-12 flex items-end justify-between">
          <h2 className="text-4xl font-bold text-secondary">Comunicati stampa</h2>
          <a href="/comunicati" className="text-primary hover:underline">
            Vedi tutti →
          </a>
        </header>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <ComunicatiCard key={c.slug} item={c} onOpen={setOpen} />
          ))}
        </div>
      </div>

      {/* ─── POP-UP ─────────────────────────────────────────── */}
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
    </section>
  )
}
