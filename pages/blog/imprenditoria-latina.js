// pages/blog/[slug].js
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import { Facebook, Twitter, Linkedin, Link as LinkIcon, Heart } from 'lucide-react'

export default function BlogPost() {
  const router = useRouter()
  const { slug } = router.query

  // Dati statici di esempio per lo slug “L’Imprenditoria Latina…”
  const post = {
    id: slug,
    title: "L'Imprenditoria Latina in Italia: Un Motore di Crescita Economica e Culturale",
    author: 'FENAM',
    date: '16 marzo 2025',
    readTime: 2,
    excerpt:
      "Negli ultimi decenni, l'Italia ha assistito a una crescita significativa dell'imprenditoria latina, un fenomeno che sta contribuendo in modo sostanziale all'economia e al tessuto sociale del paese. Gli imprenditori latinoamericani, con la loro energia, creatività e spirito di iniziativa, stanno aprendo nuove attività, creando posti di lavoro e portando una ventata di innovazione in diversi settori.",
    heroImage: {
      src: '/img/imprenditoria-latina.jpg', // metti la tua immagine
      alt: 'Riunione imprenditori'
    },
    content: [
      {
        type: 'heading',
        text: 'Un Contributo Economico Vitale'
      },
      {
        type: 'paragraph',
        text:
          'L\'imprenditoria latina in Italia è un motore di crescita economica. Secondo il rapporto "Imprenditoria immigrata in Italia" della Fondazione Leone Moressa (2023), le imprese guidate da cittadini latinoamericani sono in costante aumento, con una particolare concentrazione nei settori del commercio, della ristorazione, dei servizi alla persona e dell\'edilizia. Queste attività generano un importante indotto economico, contribuendo al PIL e al gettito fiscale. “L\'imprenditoria immigrata, e in particolare quella latina, rappresenta una risorsa fondamentale per l\'economia italiana, in grado di creare valore aggiunto e di stimolare la competitività” (Fondazione Leone Moressa, 2023).'
      },
      {
        type: 'heading',
        text: 'Un Impatto Sociale e Culturale Profondo'
      },
      {
        type: 'paragraph',
        text:
          'Oltre al contributo economico, gli imprenditori latinoamericani svolgono un ruolo cruciale nell’arricchire il tessuto sociale e culturale dell’Italia. Portano con sé tradizioni, valori e competenze uniche, che si riflettono nelle loro attività e nelle interazioni con la comunità locale. Ristoranti, negozi di prodotti tipici, centri culturali e associazioni sono solo alcuni esempi di come l’imprenditoria latina stia contribuendo a promuovere la diversità culturale e a creare ponti tra l’Italia e l’America Latina. “L’integrazione degli immigrati passa anche attraverso l’imprenditoria, che favorisce lo scambio culturale e la creazione di reti sociali” (Ministero del Lavoro e delle Politiche Sociali, 2022).'
      },
      {
        type: 'heading',
        text: 'Sfide e Opportunità'
      },
      {
        type: 'paragraph',
        text:
          'Nonostante i successi, gli imprenditori latinoamericani in Italia affrontano ancora diverse sfide, tra cui l’accesso al credito, la burocrazia e la difficoltà di riconoscimento dei titoli di studio. Tuttavia, il loro spirito di resilienza e la loro capacità di adattamento li rendono protagonisti di una storia di successo, che offre anche delle opportunità di crescita. Il governo e le istituzioni locali stanno riconoscendo sempre più l’importanza di sostenere l’imprenditoria immigrata, attraverso programmi di formazione, finanziamenti agevolati e servizi di consulenza.'
      },
      {
        type: 'heading',
        text: 'Conclusione'
      },
      {
        type: 'paragraph',
        text:
          'L’imprenditoria latina in Italia è una realtà dinamica e in crescita, che sta contribuendo in modo significativo all’economia e alla società italiana. Il loro spirito di iniziativa, la loro creatività e la loro ricchezza culturale rappresentano un valore aggiunto per il paese, che può trarre vantaggio dalla diversità e dall’apertura verso il mondo.'
      }
    ],
    bibliography: [
      'Fondazione Leone Moressa (2023). "Imprenditoria immigrata in Italia."',
      'Ministero del Lavoro e delle Politiche Sociali (2022). "Rapporto annuale sull’immigrazione".',
      'ISTAT (Istituto Nazionale di Statistica). "Dati sull’imprenditoria straniera in Italia".'
    ],
    quote:
      '“L\'imprenditoria immigrata, e in particolare quella latina, rappresenta una risorsa fondamentale per l\'economia italiana, in grado di creare valore aggiunto e di stimolare la competitività” (Fondazione Leone Moressa, 2023).',
    views: 11,
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
        <section className="prose prose-lg prose-secondary mt-12">
          {post.content.map((block, i) => {
            if (block.type === 'heading')
              return <h2 key={i}>{block.text}</h2>
            if (block.type === 'paragraph')
              return <p key={i}>{block.text}</p>
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

          {/* Citazione */}
          <div>
            <h3 className="font-semibold text-secondary mb-4">Citazione di riferimento:</h3>
            <blockquote className="border-l-4 border-primary pl-4 italic text-secondary">
              {post.quote}
            </blockquote>
          </div>

          {/* Condividi & Statistiche */}
          <div className="flex items-center justify-between border-t border-secondary/30 pt-8 text-secondary/70">
            <div className="flex gap-4">
              <Facebook size={20} className="cursor-pointer hover:text-primary"/>
              <Twitter size={20} className="cursor-pointer hover:text-primary"/>
              <Linkedin size={20} className="cursor-pointer hover:text-primary"/>
              <LinkIcon size={20} className="cursor-pointer hover:text-primary"/>
            </div>
            <div className="flex items-center gap-8">
              <span>{post.views} visualizzazioni</span>
              <span>{post.commentsCount} commenti</span>
              <Heart size={20} className="cursor-pointer hover:text-red-500"/>
            </div>
          </div>
        </footer>

        {/* ─── COMMENTI ─────────────────────────────────────────────────────── */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold text-secondary mb-6">Commenti</h2>
          <textarea
            placeholder="Scrivi un commento..."
            className="w-full rounded-lg border border-secondary/30 p-3 text-secondary focus:ring-primary focus:border-primary"
            rows={4}
          />
        </section>
      </article>
    </>
  )
}
