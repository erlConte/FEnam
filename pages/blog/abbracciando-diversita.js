// pages/blog/abbracciando-diversita.js
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'

export default function BlogPost() {
  const router = useRouter()
  const { slug } = router.query

  // Dati statici per lo slug “abbracciando-diversita”
  const post = {
    id: slug,
    title: 'Abbracciando la Diversità: il futuro della moda',
    author: 'Natalia Beltran Gomez',
    date: '10 Giugno 2025',
    readTime: 3,
    excerpt:
      'La moda è sempre stata un riflesso della società, un mezzo per esprimere la nostra identità e la nostra visione del mondo.',
    heroImage: {
      src: '/img/blog/pozzanghera.jpg',
      alt: 'Modelli di varie taglie e colori della pelle'
    },
    content: [
      {
        type: 'paragraph',
        text:
          'La moda è sempre stata un riflesso della società, un mezzo per esprimere la nostra identità e la nostra visione del mondo. Tuttavia, per troppo tempo, il mondo della moda ha faticato a rappresentare adeguatamente la diversità della nostra società. Oggi, però, stiamo assistendo a un cambiamento significativo, con brand e designer che stanno abbracciando l\'inclusività e la rappresentazione di tutte le forme, taglie e identità.'
      },
      {
        type: 'paragraph',
        text:
          'Secondo uno studio di McKinsey & Company, il 75% dei consumatori ritiene importante che i brand riflettano la diversità nella loro pubblicità e nelle loro collezioni. Eppure, come sottolinea Sinéad Burke, attivista e designer irlandese, "la moda è stata a lungo un\'industria che ha escluso e marginalizzato molte persone" (Burke, 2019).'
      },
      {
        type: 'paragraph',
        text:
          '"La diversità nella moda non è solo una questione estetica", afferma Elaine Welteroth, ex caporedattore di Teen Vogue. "È una questione di giustizia sociale, di rappresentanza e di dare voce a coloro che sono stati emarginati per troppo tempo" (Welteroth, 2018).'
      },
      {
        type: 'paragraph',
        text:
          'Marchi come Savage X Fenty di Rihanna, Chromat e Aerie stanno ridefinendo gli standard di bellezza, mettendo in mostra modelle di ogni taglia, etnia e abilità fisica. Questa inclusività non solo risuona con i consumatori, ma sta anche spingendo l\'intera industria verso un futuro più equo e rappresentativo.'
      },
      {
        type: 'paragraph',
        text:
          '"Quando vedi persone come te rappresentate nella moda, ti senti visto, riconosciuto e valorizzato", sottolinea la modella curvy Paloma Elsesser. "Questo ha un impatto profondo sulla nostra autostima e sul nostro senso di appartenenza" (Elsesser, 2021).'
      },
      {
        type: 'paragraph',
        text:
          'La strada verso una maggiore diversità nella moda non è stata facile, ma grazie agli sforzi di attivisti, designer e consumatori consapevoli, stiamo finalmente iniziando a vedere un cambiamento significativo. Mentre continuiamo a spingere per una rappresentazione più autentica e inclusiva, possiamo sperare in un futuro in cui la moda rifletta veramente la bellezza e la diversità del nostro mondo.'
      }
    ],
    bibliography: [
      'McKinsey & Company (2020). "Diversity Matters".',
      'Burke, Sinéad (2019). "Diversity in Fashion".',
      'Welteroth, Elaine (2018). "Inclusivity in Fashion".',
      'Elsesser, Paloma (2021). "Self-esteem and Representation".'
    ],
    views: 0,
    commentsCount: 0
  }

  if (router.isFallback || !post) {
    return <p>Loading…</p>
  }

  return (
    <>
      <Head>
        <title>{post.title} — FENAM</title>
        <meta name="description" content={post.excerpt} />
      </Head>

      <article className="mx-auto max-w-3xl px-6 py-16">
        {/* ─── HEADER ────────────────────────────────────────────────────────── */}
        <header className="space-y-6">
          <div className="flex items-center gap-3 text-sm text-secondary/70">
            <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center">
              {/* potresti sostituire con avatar utente */}
              <svg className="w-4 h-4 text-secondary/70">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
            </div>
            <span>{post.author} · {post.date} · {post.readTime} Min.</span>
          </div>

          <h1 className="text-4xl font-extrabold text-secondary leading-tight">
            {post.title}
          </h1>

          <hr className="border-secondary/30" />

          <p className="text-lg text-secondary">{post.excerpt}</p>

          {post.heroImage && (
            <figure className="mt-8 overflow-hidden rounded-2xl">
              <Image
                src={post.heroImage.src}
                alt={post.heroImage.alt}
                width={800}
                height={450}
                className="w-full object-cover"
              />
            </figure>
          )}
        </header>

        {/* ─── CONTENUTO ─────────────────────────────────────────────────────── */}
        <section className="mt-12 space-y-8">
          {post.content.map((block, i) => {
            if (block.type === 'heading')
              return (
                <h2
                  key={i}
                  className="text-lg font-bold text-secondary leading-snug"
                >
                  {block.text}
                </h2>
              )
            if (block.type === 'paragraph')
              return (
                <p key={i} className="text-lg text-secondary">
                  {block.text}
                </p>
              )
            return null
          })}
        </section>
        {/* ─── FINE ARTICOLO ─────────────────────────────────────────────────── */}
        <hr className="my-16 border-secondary/30" />

        <footer className="space-y-12">
          {/* Bibliografia */}
          <div>
            <h3 className="font-semibold text-secondary mb-4">Bibliografia:</h3>
            <ul className="list-disc pl-5 text-secondary">
              {post.bibliography.map((ref, i) => (
                <li key={i}>{ref}</li>
              ))}
            </ul>
          </div>
          <hr className="my-16 border-secondary/30" />
          {/* Condividi & Statistiche */}
          <div></div>
          <Link href="/blog" className="text-secondary hover:underline">
            ← Torna ai blog
          </Link>
        </footer>
      </article>
    </>
  )
}
