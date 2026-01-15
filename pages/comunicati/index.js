// pages/comunicati/index.js
import Head from 'next/head'
import { useState } from 'react'
import ComunicatiCard from '../../components/ComunicatiCard'

/* ------------------------------------------------------------------
   Array comunicati – basta aggiungere un oggetto!
   IMPORTANTE: tutti gli oggetti devono avere la stessa struttura:
   { slug, title, date, cover }
-------------------------------------------------------------------*/
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
  // { slug: 'altro', title: '…', date: '…', cover: '/img/comunicati/…' },
]

export default function Comunicati() {
  const [open, setOpen] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Filtra solo comunicati validi (con tutti i campi richiesti)
  const validComunicati = comunicati.filter(
    (c) => c.slug && c.title && c.date && c.cover
  )

  const handleOpen = (item) => {
    setOpen(item)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleClose = () => {
    setOpen(null)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((prev) => Math.max(0.5, Math.min(3, prev * delta)))
  }

  const handleMouseDown = (e) => {
    if (e.button !== 0) return // solo tasto sinistro
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleDoubleClick = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <>
      <Head><title>Comunicati stampa | FENAM</title></Head>

      <section className="bg-paper py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="mb-12 text-5xl italic text-secondary">
            Comunicati stampa
          </h1>

          <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-3">
            {validComunicati.map((c) => (
              <ComunicatiCard key={c.slug} item={c} onOpen={handleOpen} />
            ))}
          </div>

          {/* POP-UP con zoom e drag */}
          {open && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) handleClose()
              }}
              onWheel={handleWheel}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div className="relative max-h-[90vh] max-w-[90vw]">
                <img
                  src={open.cover}
                  alt={open.title || ''}
                  className="rounded-2xl shadow-2xl cursor-move select-none"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transition: isDragging ? 'none' : 'transform 0.1s',
                    maxHeight: '90vh',
                    maxWidth: '90vw',
                  }}
                  onMouseDown={handleMouseDown}
                  onDoubleClick={handleDoubleClick}
                  draggable={false}
                />
                <button
                  onClick={handleClose}
                  className="absolute -right-12 top-0 rounded-full bg-white/90 p-2 text-black hover:bg-white"
                  aria-label="Chiudi"
                >
                  ✕
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white">
                  Zoom: rotella · Trascina: mouse · Reset: doppio click
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
