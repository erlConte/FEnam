// pages/affiliazione.js
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import AffiliazioneForm from '../components/AffiliazioneForm'

export default function Affiliazione() {
  const router = useRouter()
  const { return: returnParam, source } = router.query
  const returnUrl = typeof returnParam === 'string' ? returnParam : ''
  const fromEnotempo = source === 'enotempo'
  const isAlreadySocio = router.query.success === '1'

  const accediSocioHref = fromEnotempo && returnUrl
    ? `/accedi-socio?source=enotempo&returnUrl=${encodeURIComponent(returnUrl)}`
    : '/accedi-socio?source=fenam'

  if (isAlreadySocio) {
    return (
      <>
        <Head><title>Affiliazione | FENAM</title></Head>
        <div className="bg-paper">
          <div className="mx-auto max-w-7xl px-6 pt-6">
            <p className="bullet-title text-secondary">Affiliazione</p>
          </div>
        </div>
        <section className="bg-paper py-16 px-4 sm:px-6">
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl border border-primary/30 bg-[#e8f5f5] p-6 sm:p-8 shadow-md">
              <p className="text-lg font-semibold text-secondary mb-2">
                Risulti già socio FENAM. Non è necessario effettuare una nuova affiliazione.
              </p>
              <p className="text-sm text-secondary/80 mb-6">
                Puoi continuare la navigazione sul sito o accedere come socio se provieni da un servizio partner.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Torna alla home
              </Link>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <Head><title>Affiliazione | FENAM</title></Head>

      {/* breadcrumb/title */}
      <div className="bg-paper">
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <p className="bullet-title text-secondary">Affiliazione</p>
        </div>
      </div>

      {/* HERO */}
      <section className="bg-paper pb-24 pt-10">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <div className="flex flex-col gap-6">
            {/* CTA "Già socio?" — premium, sopra il form; in evidenza se da Enotempo */}
            <div
              className={`rounded-2xl border shadow-md transition-colors p-4 sm:p-5 ${
                fromEnotempo
                  ? 'border-primary/40 bg-[#e8f5f5]'
                  : 'border-secondary/15 bg-white'
              }`}
              role="region"
              aria-label="Accesso socio già affiliato"
            >
              <p className="text-sm font-semibold text-secondary mb-1">
                {fromEnotempo ? 'Hai già pagato la tessera? Non ripagare.' : 'Sei già socio?'}
              </p>
              <p className="text-xs text-secondary/80 mb-4">
                {fromEnotempo
                  ? 'Accedi con la tua email per tornare su Enotempo senza rifare il pagamento.'
                  : 'Inserisci la tua email e riceverai un link per accedere.'}
              </p>
              <Link
                href={accediSocioHref}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Accedi come socio
              </Link>
            </div>

            <AffiliazioneForm />
          </div>
          <div className="space-y-6 self-center">
            <h1 className="text-4xl font-bold leading-snug text-secondary">
              Un Mondo di Opportunità Ti Aspetta:<br />
              Scopri i Vantaggi Esclusivi!
            </h1>
            <p className="max-w-prose text-secondary/90">
            Non perdere l'opportunità di accedere a un universo di vantaggi pensati per imprese, associazioni e individui come te. Con una piccola quota annuale, potrai godere di una serie di servizi esclusivi che arricchiranno la tua vita quotidiana.
 
 Immagina di avere una polizza assicurativa gratuita che ti offre serenità, assistenza tecnica sempre a disposizione per ogni tua necessità, e tariffe vantaggiose su Luce, Gas e Internet, così da risparmiare senza sacrificare la qualità.
 Inoltre, partecipa a eventi di networking esclusivi per ampliare la tua rete e scambiare idee con professionisti del tuo settore. Approfitta di consulenze gratuite per affrontare le tue sfide e ricevi sconti su pratiche burocratiche, semplificando così la tua vita.
 Investi nel tuo futuro oggi stesso! Trasforma la tua esperienza in un viaggio ricco di opportunità e inizia a raccogliere i frutti delle tue scelte. Unisciti a noi e scopri quanto può essere gratificante!
            </p>
          </div>
        </div>
      </section>

     {/* ---------- TITOLO GLOBALE ---------- */}
<section className="bg-[#9ad9d9] pt-20 text-secondary">
  <div className="mx-auto max-w-7xl px-6">
    <h2 className="text-3xl lg:text-4xl font-bold text-left">
      Offerta Servizi per Tesserati
    </h2>
  </div>
</section>

{/* ---------- VERSIONE IMPRESE ---------- */}
<section className="bg-[#9ad9d9] pb-24 text-secondary">
  <div className="mx-auto max-w-7xl space-y-6 px-6 text-sm leading-normal">

    <p className="font-medium">
      1. <b>Versione per Imprese</b> | Tessera Imprese: <b>250 €</b> all’anno
    </p>

    <p className="font-semibold">Servizi Inclusi:</p>

    <p className="font-medium">Polizza Assicurativa Gratuita</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Copertura fino a €300 per ogni intervento.</li>
      <li>Invio di tecnici qualificati.</li>
    </ul>

    <p className="font-medium">Convenzioni</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Tariffe vantaggiose per Luce, Gas, Internet.</li>
    </ul>

    <p className="font-medium">Eventi e Progetti</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Partecipazione a eventi normali e premium. </li>
    </ul>

    <p className="font-medium">Sconti e Consulenze</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Analisi e posizionamento associativo.</li>
      <li>Sconti su traduzioni ufficiali.</li>
    </ul>

    <p className="font-medium">Servizi CAF/PATRONATO</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Consulenze gratuite per pratiche.</li>
    </ul>

    <p className="font-medium">Supporto Lavorativo</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Consulenza gratuita per inserimento lavorativo.</li>
    </ul>

    <p className="font-medium">Confronto di Mercato</p>

    <p className="font-semibold">Servizi simili di altre associazioni:</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Prezzi medi per tessere associative: 300 € – 500 €.</li>
      <li>Polizze assicurative simili: circa 100 €/anno.</li>
      <li>Consulenze professionali: 50 € – 100 € a sessione.</li>
    </ul>

    <p className="font-medium">
      <b>Risparmio Totale:</b> con la nostra tessera risparmi fino a 250 € e ottieni più servizi!
    </p>
  </div>
</section>

{/* ---------- VERSIONE ASSOCIAZIONI / INDIVIDUI ---------- */}
<section className="bg-cream py-24 text-secondary">
  <div className="mx-auto max-w-7xl space-y-6 px-6 text-sm leading-normal">

    <p className="font-medium">
      2. <b>Versione per Associazioni e Individui</b> | Tessera Associazioni:
      <b> 100 €</b>/anno | Tessera Individuale: <b>60 €</b>/anno
    </p>

    <p className="font-semibold">Servizi Inclusi:</p>

    <p className="font-medium">Polizza Assicurativa Gratuita</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Copertura fino a €300.</li>
    </ul>

    <p className="font-medium">Convenzioni e Sconti</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Tariffe vantaggiose su Luce, Gas e Internet.</li>
      <li>Sconti su traduzioni e consulenze pratiche.</li>
    </ul>

    <p className="font-medium">Eventi e Networking</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Partecipazione a eventi aperti e premium.</li>
    </ul>

    <p className="font-medium">Servizi CAF/PATRONATO</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Consulenze gratuite e sconti su pratiche.</li>
    </ul>

    <p className="font-medium">Supporto Professionale</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Prima consulenza gratuita per il lavoro.</li>
    </ul>

    <p className="font-medium">Confronto di Mercato</p>

    <p className="font-semibold">Servizi simili di altre associazioni:</p>
    <ul className="list-disc space-y-0.5 pl-5">
      <li>Prezzi medi tessere: 100 € – 200 €.</li>
      <li>Polizze: circa 50 €/anno.</li>
      <li>Consulenze: 30 € – 70 € a sessione.</li>
    </ul>

    <p className="font-medium">
      <b>Risparmio Totale:</b> servizi di valore superiore a costo inferiore rispetto alla media!
    </p>
  </div>
</section>


      {/* CONCLUSIONE */}
      <section className="bg-[#8fd1d2] py-24 text-center text-secondary">
        <div className="mx-auto max-w-3xl space-y-3 px-6">
          <h3 className="text-lg font-semibold">Conclusione</h3>
          <p className="text-sm">
            Unisciti a noi per accedere a servizi esclusivi, risparmi significativi e
            opportunità di networking che faranno crescere la tua impresa o
            supporteranno le tue esigenze personali!
          </p>
        </div>
      </section>
    </>
  )
}
