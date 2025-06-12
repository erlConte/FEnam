import Image from 'next/image'
import Link from 'next/link'
import Card from './ui/Card'

export default function Hero() {
  return (
    <header className="relative isolate bg-paper">
      {/* ---------- headline ---------- */}
      <div
        className="mx-auto max-w-7xl px-6"
        style={{
          paddingTop: 'clamp(0.5rem, 8vw, 4rem)',
          paddingBottom: 'clamp(0.5rem, 8vw, 4rem)',
        }}
      >
        <h1
          className="font-bold leading-tight text-secondary"
          style={{ fontSize: 'clamp(2rem, 8vw, 5rem)' }}
        >
          Creiamo&nbsp;
          <em className="italic font-normal text-primary">ponti culturali</em>
          <br />
          tra le nazioni
        </h1>

        <div className="mt-4 inline-flex items-center gap-2">
          <span className="rounded-full border border-secondary px-4 py-1 text-xs">
            Federazione Nazionale Associazioni Multiculturali
          </span>
          <Image
            src="/img/FENAM-ICON.png"
            alt=""
            width={32}
            height={32}
            className="h-7 w-7 rounded-full border border-secondary bg-primary/20"
            priority
          />
        </div>
      </div>

      {/* ---------- immagine + card affiliazione --------- */}
      <div className="relative overflow-hidden rounded-t-[1.5rem]">
        <Image
          src="/img/hero-team.jpg"
          alt=""
          width={1600}
          height={900}
          priority
          className={`
            w-full
            object-cover
            /* effetto fluido da md in su */
            md:h-[clamp(40vh,60vw,70vh)]
            /* sotto md altezza fissa */
            h-[50vh]
          `}
        />

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link href="/affiliazione">
            <Card
              icon="/img/FENAM-ICON.png"
              className="w-[85vw] max-w-xs sm:w-72 md:w-80 lg:w-96 text-center"
            >
              <span className="mb-3 inline-block rounded-full border border-secondary bg-primary/20 px-4 py-1 text-xs font-semibold">
                Acquista ora
              </span>

              <h2 className="text-3xl md:text-4xl font-bold leading-snug text-night">
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
