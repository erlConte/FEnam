import Head from 'next/head'
import Image from 'next/image'

export default function ImprenditoriaLatina() {
  return (
    <>
      <Head>
        <title>L'Imprenditoria Latina in Italia | FENAM</title>
        <meta
          property="og:title"
          content="L'Imprenditoria Latina in Italia: Un Motore di Crescita Economica e Culturale"
        />
        <meta property="og:type" content="article" />
        <meta property="article:author" content="FENAM" />
      </Head>

      <article className="prose mx-auto px-6 py-24 lg:prose-lg">
        <Image
          src="/img/imprenditoria-latina.jpg"
          alt=""
          width={1200}
          height={600}
          className="rounded-2xl"
          priority
        />

        <h1>
          L&apos;Imprenditoria Latina in Italia: Un Motore di Crescita Economica
          e Culturale
        </h1>

        <p>
          Negli ultimi decenni, l&apos;Italia ha assistito a una crescita
          significativa dell&apos;imprenditoria latina, un fenomeno che sta
          contribuendo in modo sostanziale all&apos;economia e al tessuto
          sociale del paese. Gli imprenditori latino-americani, con la loro
          energia, creatività e spirito di iniziativa, stanno aprendo nuove
          attività, creando posti di lavoro e portando una ventata di
          innovazione in diversi settori.
        </p>

        <h2>Un Contributo Economico Vitale</h2>
        <p>
          L&apos;imprenditoria latina in Italia è un motore di crescita
          economica. Secondo il rapporto &quot;Imprenditoria immigrata in
          Italia&quot; della Fondazione Leone Moressa (2023)…
        </p>

        {/* — continua incollando tutto il testo che hai riportato — */}

        <h2>Conclusione</h2>
        <p>
          L&apos;imprenditoria latina in Italia è una realtà dinamica e in
          crescita…
        </p>

        <h3>Bibliografia</h3>
        <ul>
          <li>Fondazione Leone Moressa (2023). "Imprenditoria immigrata in Italia."</li>
          <li>Ministero del Lavoro e delle Politiche Sociali (2022). "Rapporto annuale sull&apos;immigrazione".</li>
          <li>ISTAT. "Dati sull&apos;imprenditoria straniera in Italia".</li>
        </ul>
      </article>
    </>
  )
}
