import Head from 'next/head'

export default function About() {
  return (
    <>
      <Head><title>Chi Siamo | FENAM</title></Head>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <h1 className="mb-6 text-4xl md:text-4xl font-bold leading-snug text-night">Chi Siamo</h1>
        <p className="mb-4 text-gray-700">
          La Federazione Nazionale di Associazioni Multiculturali (FE.N.A.M.)  si dedica a promuovere l'accoglienza e lo sviluppo delle comunità multiculturali in un contesto globale, attraverso  l’empowerment personale e professionale degli individui attraverso iniziative educative, culturali e sociali. 
Riteniamo che il potenziamento individuale sia essenziale per stimolare la crescita economica e sociale. 
Creiamo ponti bilaterali tra i paesi dell'America Latina, dell'Africa e l'Italia, nel rispetto dei valori e dei principi di ogni cultura rappresentata.
Insieme, possiamo costruire un ecosistema dinamico e prospero, favorendo opportunità per tutti a livello mondiale.
        </p>
        {/* Inserisci altri dettagli, timeline, foto del team… */}
      </section>
    </>
  )
}
