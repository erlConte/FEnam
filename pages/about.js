import Head from 'next/head'

export default function About() {
  return (
    <>
      <Head><title>Chi Siamo | FENAM</title></Head>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="mb-6 text-4xl font-bold">Chi Siamo</h1>
        <p className="mb-4 text-gray-700">
          In FENAM, siamo convinti che il potenziamento individuale sia
          fondamentale per stimolare la crescita economica e sociale. La nostra
          missione è essere un catalizzatore di cambiamento dove ogni cultura
          contribuisce a un ecosistema dinamico e prospero.
        </p>
        {/* Inserisci altri dettagli, timeline, foto del team… */}
      </section>
    </>
  )
}
