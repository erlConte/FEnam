import Image from 'next/image'
import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

export default function Hero() {
  /* ----- piccolo effetto parallax card rispetto allo scroll ----- */
  const ref       = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, 100])   // card scende di 100 px

  return (
    <header ref={ref} className="relative isolate bg-paper">
      {/* ---- TESTO ---- */}
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-32 md:pt-40">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight text-secondary">
          Creiamo&nbsp;
          <em className="not-italic font-normal italic text-primary">
            ponti culturali
          </em>
          <br />
          tra le nazioni
        </h1>

        {/* pill descrizione */}
        <div className="mt-8 inline-flex items-center gap-2">
          <span className="rounded-full border border-secondary px-4 py-1 text-xs">
            Federazione Nazionale Associazioni Multiculturali
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-secondary bg-primary/20 text-secondary">
            <RotateCcw size={16} />
          </span>
        </div>
      </div>

      {/* ---- IMMAGINE HERO ---- */}
      <div className="relative rounded-t-[1.5rem] overflow-hidden">
        <Image
          src="/img/hero-team.jpg"
          alt="Team multiculturale al lavoro"
          width={2400}
          height={1200}
          priority
          className="aspect-[3/2] w-full object-cover md:h-[70vh]"
        />

        {/* -------- card CENTRATA -------- */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link
            href="/affiliazione"
            className="relative block w-[85vw] max-w-xs rounded-3xl bg-cream/90 p-6 shadow-lg backdrop-blur
                       sm:w-72 md:w-80 lg:w-96">
            <Image
  src="/img/FENAM-ICON.png"
  alt=""
  width={32}
  height={32}
  className="absolute -right-0 -top-0 select-none"
  priority
/>

            <span className="mb-3 inline-block rounded-full border border-secondary bg-primary/20 px-4 py-1 text-xs font-semibold">
              Acquista ora
            </span>

            <h2 className="text-3xl md:text-4xl font-bold leading-snug text-secondary">
              Carta di<br />Affiliazione
            </h2>
            <p className="mt-4 text-xs text-secondary/80 max-w-[30ch]">
              Un Mondo di Opportunità Ti Aspetta: Scopri i Vantaggi Esclusivi!
            </p>
          </Link>
        </div>
      </div>
    </header>
  )
}
