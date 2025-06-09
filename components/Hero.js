import Image from 'next/image'
import Link from 'next/link'
import Card from './ui/Card'

export default function Hero() {
  return (
    <header className="relative isolate bg-paper">
      {/* ---------- headline ---------- */}
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-32 md:pt-40">
        <h1 className="text-4xl md:text-6xl font-bold leading-tight text-secondary">
          Creiamo&nbsp;
          <em className="not-italic italic font-normal text-primary">ponti culturali</em><br />
          tra le nazioni
        </h1>

        <div className="mt-8 inline-flex items-center gap-2">
          <span className="rounded-full border border-secondary px-4 py-1 text-xs">
            Federazione Nazionale Associazioni Multiculturali
          </span>
          <span className="h-7 w-7 rounded-full border border-secondary bg-primary/20" />
        </div>
      </div>

      {/* ---------- immagine --------- */}
      <div className="relative overflow-hidden rounded-t-[1.5rem]">
        <Image
          src="/img/hero-team.jpg"
          alt=""
          width={1600}
          height={900}
          priority
          className="w-full aspect-[3/2] object-cover md:h-[70vh]"
        />

        {/* ---------- card affiliazione --------- */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link href="/affiliazione">
            <Card
              icon="/img/FENAM-ICON.png"
              className="w-[85vw] max-w-xs sm:w-72 md:w-80 lg:w-96 text-center"
            >
              <span className="mb-3 inline-block rounded-full border border-secondary bg-primary/20 px-4 py-1 text-xs font-semibold">
                Acquista ora
              </span>

              <h2 className="text-3xl md:text-4xl font-bold leading-snug">
                Carta di<br />Affiliazione
              </h2>
              <p className="mx-auto mt-4 max-w-[30ch] text-xs text-secondary/80">
                Un Mondo di Opportunità Ti Aspetta: Scopri i Vantaggi Esclusivi!
              </p>
            </Card>
          </Link>
        </div>
      </div>
    </header>
  )
}
