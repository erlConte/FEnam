// pages/progetti/dinoi.js
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'

export default function DinoiProject() {
  const project = {
    title: 'DINOI: Un Modello Innovativo di Eco-Gastronomia e Scambio Culturale',
    cover: '/img/DINOI.jpg',
    content: [
      {
        type: 'paragraph',
        text: `FENAM è orgogliosa di presentare DINOI, un progetto all'avanguardia che incarna i valori di innovazione, sostenibilità e scambio culturale, fungendo da ponte tra la ricca tradizione gastronomica italiana e il dinamismo del continente latinoamericano. È con grande piacere che annunciamo che FENAM collabora in sinergia con DINOI, supportando attivamente questa iniziativa rivoluzionaria che sta ridefinendo il settore alimentare e culturale, dimostrando come un approccio etico e tecnologicamente avanzato possa generare valore condiviso e opportunità globali.`,
      },
      {
        type: 'heading',
        text: 'La Nascita di un Progetto Eco-Gastronomico',
      },
      {
        type: 'paragraph',
        text: `DINOI nasce dalla visione e dalla sinergia di imprenditori italiani con un’eredità gastronomica di 300 anni e il fervore imprenditoriale di partner colombiani. Il cuore del progetto risiede nella creazione della prima piattaforma eco-gastronomica in Colombia, un modello che integra il know-how e la tecnologia italiana con la forza lavoro, gli insumi e il dinamismo imprenditoriale antioqueño. Questo approccio permette a DINOI di produrre direttamente in loco (nella sua sede de La Strada, a El Poblado), garantendo:`,
      },
      {
        type: 'list',
        items: [
          'Accessibilità e Qualità: Contrariamente all’importazione di prodotti italiani spesso costosi e di qualità inferiore, DINOI offre alta qualità a prezzi moderati e accessibili al consumatore, rendendo l’autentica gastronomia italiana accessibile a un pubblico più ampio.',
          'Sostenibilità Ambientale: L’eco-gastronomia di DINOI minimizza l’impatto ambientale, riducendo la necessità di movimentare merci con navi o aerei. Si “muovono” il sapere e le tecnologie avanzate, non barche o aerei.',
          'Impatto Socio-Economico Locale: Il progetto genera ricchezza che rimane nel territorio, contribuendo alla trasformazione degli insumi in prodotti per la tavola. Questo si traduce in benefici concreti per i produttori e le loro famiglie, attraverso la valorizzazione dei prodotti della terra (es. tramite il processo di conserva), contribuendo al passaggio da un’economia primaria a una secondaria.',
        ],
      },
      {
        type: 'heading',
        text: 'Oltre la Cucina: L’Esperienza Culturale',
      },
      {
        type: 'paragraph',
        text: `DINOI non si limita alla produzione alimentare; è un progetto culturale a tutto tondo. Ogni mese, offre a Medellín un'esclusiva “esperienza di un viaggio gastronomico” a una diversa regione d'Italia. Non si tratta di semplici cene in un ristorante, ma di vere e proprie “esperienze culturali” che portano in tavola la cucina delle nonne italiane – espressione di una tradizione umile, ricca di fantasia e storia, che ha dato vita a migliaia di piatti. DINOI si impegna a divulgare questa autenticità, lontana dalle logiche delle stelle Michelin, per avvicinare la vera tradizione italiana al pubblico locale e ai suoi visitatori.`,
      },
      {
        type: 'heading',
        text: 'Un Progetto Nato dalla Collaborazione Internazionale',
      },
      {
        type: 'paragraph',
        text: `Le radici di DINOI affondano nel Foro Pymes I.I.L.A. tra Italia e America Latina, tenutosi a Medellín nel marzo 2022, e nell’alleanza strategica tra le Camere di Commercio del Veneto e di Antioquia, realizzata nello stesso Foro. Questo contesto evidenzia l’importanza del progetto come modello di capitalismo progettuale di missione, pienamente compatibile con la logica imprenditoriale e orientato al bene comune.`,
      },
      {
        type: 'paragraph',
        text: `FENAM, attraverso la sua sinergia con DINOI, riconosce in questa iniziativa un esempio virtuoso di come l’imprenditoria possa promuovere lo sviluppo sostenibile, l’innovazione e il dialogo interculturale, contribuendo a migliorare la qualità della vita attraverso la valorizzazione del patrimonio gastronomico e lo scambio di competenze. Siamo fieri di supportare un progetto che non solo fa “bene quello che serve e quello che è buono per il territorio”, ma che eleva l’esperienza gastronomica a un veicolo di cultura e integrazione.`,
      },
    ],
  }

  return (
    <>
      <Head>
        <title>{project.title} — Progetti | FENAM</title>
        <meta name="description" content={project.content[0].text} />
      </Head>

      <article className="mx-auto max-w-3xl px-6 py-16 space-y-8">
        <h1 className="text-4xl font-extrabold text-secondary leading-tight">
          {project.title}
        </h1>

        <figure className="overflow-hidden rounded-2xl">
          <div className="relative h-64 sm:h-96">
            <Image
              src={project.cover}
              alt={project.title}
              fill
              className="object-cover"
            />
          </div>
        </figure>

        <section className="space-y-6 text-secondary">
          {project.content.map((block, i) => {
            if (block.type === 'heading') {
              return (
                <h2 key={i} className="text-2xl font-semibold">
                  {block.text}
                </h2>
              )
            }
            if (block.type === 'paragraph') {
              return (
                <p key={i} className="text-lg leading-relaxed">
                  {block.text}
                </p>
              )
            }
            if (block.type === 'list') {
              return (
                <ul key={i} className="list-disc pl-6 space-y-2">
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )
            }
            return null
          })}
        </section>

        <div className="mt-8">
          <Link href="/progetti" className="text-primary hover:underline">
            ← Torna ai progetti
          </Link>
        </div>
      </article>
    </>
  )
}
