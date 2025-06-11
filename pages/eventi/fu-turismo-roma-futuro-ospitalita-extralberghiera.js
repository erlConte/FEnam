import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function FuTurismoDetail() {
  // Static data for FU TURISMO event – includes ALL details provided
  const evt = {
    slug: "fu-turismo-roma-futuro-ospitalita-extralberghiera",
    title: "FU TURISMO: Roma e il Futuro dell’Ospitalità Extralberghiera",
    subtitle: "Auditorium Antonianum, Roma • 21 Gennaio 2025",
    date: "21 Gennaio 2025",
    location: "Auditorium Antonianum, Roma",
    excerpt:
      "“FU TURISMO” è un laboratorio di idee promosso da UNIMPRESA LAZIO dove istituzioni, imprenditori e professionisti si confronteranno per delineare il destino del settore extralberghiero.",
    images: Array.from({ length: 10 }, (_, i) => `/img/eventi/futurismo${i === 0 ? "" : i}.jpg`),
    // Full narrative broken into paragraphs for easy rendering
    description: [
      "Il 21 gennaio 2025 l’Auditorium Antonianum di Roma diventerà il cuore pulsante del dibattito sul futuro del turismo italiano.",
      "“FU TURISMO” è promosso da UNIMPRESA LAZIO: un laboratorio di idee dove istituzioni, imprenditori e professionisti si confronteranno per delineare il destino del settore extralberghiero.",
      "Il Giubileo 2025 porterà a Roma 35 milioni di visitatori e una spesa prevista di 16,7 miliardi di euro. La città e l’intera regione Lazio sono chiamate a rispondere a una sfida epocale: trasformare lo straordinario flusso turistico in un’opportunità di crescita sostenibile per l’intero ecosistema economico regionale e internazionale.",
      "“FU TURISMO” – dichiara il Presidente di UNIMPRESA LAZIO Edoardo Maria Lofoco – sarà il manifesto di questa rinascita sociale e culturale del territorio attraverso un moderno sviluppo del settore extralberghiero, connesso alle opportunità offerte da un sistema d’imprese etiche che contribuiscono alla rinascita più autentica dell’Italia. L’extralberghiero come nuova forza che genera bellezza, valore economico e orgoglio nazionale.",
      "\n### Un Sistema Turistico che parla Italiano ###",
      "Il settore extralberghiero è il riflesso più autentico del tessuto imprenditoriale italiano: migliaia di PMI, gestite con passione e saldamente radicate nel territorio. Diversamente dai grandi gruppi alberghieri – spesso controllati da multinazionali – queste realtà parlano la lingua delle comunità locali, creano reti e portano benefici concreti a borghi, famiglie e aree interne in via di spopolamento.",
      "Nel Lazio le presenze sono cresciute del 27,4 % nel 2023. Ciononostante il comparto è divenuto bersaglio di politiche punitive e narrazioni mediatiche distorte. “FU TURISMO” ribalta questa prospettiva, affermando il ruolo cruciale dell’ospitalità extralberghiera nella costruzione di un turismo più equo, sostenibile e democratico.",
      "“Il turismo extralberghiero – dichiara UNIMPRESA – con la sua autenticità e il radicamento nelle comunità locali, incarna l’essenza dell’ospitalità italiana: un intreccio di storie, tradizioni e innovazione che si oppone all’omologazione globale. Erasmus e le comunità straniere rafforzano questo tessuto, portando diversità e nuove prospettive, trasformando l’Italia in un faro di inclusione e creatività.”",
      "\n### We Love Italia: la rivoluzione digitale ###",
      "Verrà presentata **We Love Italia**, piattaforma B2B/B2C ponte tra operatori e consumatori. Non solo tecnologia, ma un catalizzatore per esperienze autentiche e sostenibili in tutto il Paese, valorizzando il Made in Italy.",
      "\n### Valorizzare le cantine storiche ###",
      "L’associazione **Radici di Futuro** illustrerà una proposta di legge per le cantine medievali del Lazio: degustazioni, laboratori d’arte e manifattura, eventi culturali, in sinergia con **ARSIAL** per integrare turismo e sviluppo agricolo.",
      "\n### Formazione, regole e competitività ###",
      "Normative chiare, formazione continua e incentivi alle PMI sono i pilastri per affrontare digitalizzazione, gestione sostenibile e accesso ai mercati globali.",
      "\n### L’Unione fa la forza ###",
      "Unimpresa Lazio, guidata da giovani imprenditori, mira a diventare il baluardo dei diritti e degli interessi degli operatori del turismo.",
      "\n### Erasmus e comunità straniere ###",
      "Il programma Erasmus è un asset strategico che porta valore economico e culturale a borghi e città; le comunità straniere in Italia arricchiscono il tessuto sociale e creano esperienze autentiche.",
      "\n### Un manifesto per il futuro ###",
      "Con il Giubileo 2025 e il richiamo globale del Made in Italy, Roma e il Lazio si ergono a simbolo dell’ambizione italiana: superare le logiche tradizionali e abbracciare un modello di turismo che celebri l’unicità del territorio, investa nella sostenibilità e garantisca crescita inclusiva.",
      "Il 21 gennaio 2025 prenderà forma una visione coraggiosa: un turismo che conserva e si reinventa, con politiche visionarie, digitalizzazione e sostenibilità come pilastri di una rinascita centrata su persone e comunità.",
      "“FU TURISMO” è il trampolino verso un futuro che valorizza non solo ciò che siamo, ma ciò che possiamo diventare.",
    ],
    // Underscored topics (ex‑"programma") – 11 key focuses
    program: [
      "PROSPETTIVE FUTURE – Analisi delle tendenze emergenti e degli scenari di domani.",
      "NORMATIVA VIGENTE – Panoramica aggiornata su leggi e regolamenti del comparto.",
      "FISCALITÀ E GESTIONE FINANZIARIA – Strategie per ottimizzare costi e ricavi.",
      "OPPORTUNITÀ DI MERCATO – Soluzioni e approcci per un turismo responsabile.",
      "INNOVAZIONE E SOSTENIBILITÀ – Progetti per un futuro green e hi‑tech.",
      "ESPERIENZE DIRETTE – Best practice raccontate dagli operatori.",
      "DIGITALIZZAZIONE E TECNOLOGIA – Strumenti per migliorare esperienza e gestione.",
      "MARKETING E PROMOZIONE – Strategie per ampliare i mercati.",
      "FORMARSI PER CRESCERE – Percorsi formativi per nuove competenze.",
      "SALVAGUARDIA DEI BORGHI / MADE IN ITALY – Valorizzazione dei piccoli centri.",
      "NETWORKING E PARTNERSHIP – Collaborazioni tra operatori, enti e istituzioni.",
    ],
    // Extended list of speakers & guests
    speakers: [
      "On. Claudio Durigon – Sottosegretario al Ministero del Lavoro e delle Politiche Sociali",
      "Sen. Marco Scurria – Segretario 4ª Commissione Politiche UE",
      "Luciano Donato – Consigliere, imprenditore edilizia e balneare",
      "On. Antonello Aurigemma – Presidente Consiglio Regionale Lazio",
      "On. Cangemi Giuseppe Emanuele – Vicepresidente Consiglio Regionale Lazio",
      "On. Giorgio Simeoni – Presidente Commissione Giubileo 2025 Lazio",
      "Mario Baccini – Sindaco di Fiumicino, Presidente Nazionale Microcredito",
      "Riccardo Travaglini – Sindaco di Castelnuovo di Porto, Presidente Radici di Futuro",
      "Carla Amici – Sindaco di Roccagorga (LT)",
      "Avv. Pierluigi Torelli – Assessore al Turismo Sermoneta, Consigliere Provincia LT",
      "Angelo Pizzigallo – Sindaco di Anguillara (RM)",
      "Pierluigi Sanna – Sindaco di Colleferro (RM)",
      "Anna Maria Bilancia – Sindaco di Priverno (LT)",
      "Eligio Tombolillo – Sindaco di Pontinia (LT)",
      "Antonio Corsi – Sindaco di Sgurgola (FR)",
      "Loreto Polidoro – Sindaco di Maenza (LT)",
      "Angelo Mattoccia – Sindaco di Pofi (FR)",
      "Ennio Afilani – Assessore di Cori (LT)",
      "Claudio Sperduti – Ex Sindaco di Maenza (LT)",
      "Domenico Guidi – Ex Sindaco di Bassiano, Consigliere Comunale",
      "Avv. Cristina Michetelli – Delegata Bilancio e Patrimonio Comune di Roma",
      "On. Giovan Battista Giorgi – Presidente Consiglio Regionale 2000",
      "Quirino Briganti – Presidente Compagnia dei Lepini",
      "Paolo Frullini – Coordinatore Green Community “Lepini Green”",
      "Mons. Jean‑Marie Gervais – Coadiutore Capitolo Basilica di San Pietro",
      "Luis Fernando Lopez – Coord. Naz. Latinoamericani, Fondazione Migrantes",
      "Luis Miguel Perea Castrillon – Vescovo, Chiesa di Dio",
      "Guillermo Cumming – Resp. Turismo Messico, Ambasciata Santa Sede",
      "Emmanuel Vargas Salas – Resp. Turismo, Ambasciata Messico",
      "Ligia Margarita Quessep Bitar – Ambasciatrice della Colombia",
      "Gabriela Gamez Granda – IIIª Segretaria Ambasciata di Cuba",
      "Nancy Marisol Hernández Mouniq – Console Generale El Salvador",
      "Daniel Rios – Imprenditore, Milano Millegusti",
      "Diana Beltran – Imprenditrice, ristoranti messicani in Europa",
      "Maria di Prato – Biotec srl",
      "Martena – Prosciuttificio Bassiano Reale",
    ],
    contacts: {
      sito: "https://www.associazionestrutturericettive.it",
      telefono: "+39 335 47 46 97",
      email: "info@unimpresalazio.it",
    },
    links: [
      "https://tr.ee/BLUVe4tIkF",
      "https://www.romameeting.it/eventi-a-roma/fu-turismo-roma-e-il-futuro-dell-ospitalita-extralberghiera-1683.htm",
      "https://www.visionlatina.it/futurismo-unimpresa-lazio-organizza-un-convegno-per-unire-e-difendere-il-settore/",
      "https://www.tgfestival.it/futurismo-unimpresa-lazio-organizza-un-convegno-per-unire-e-difendere-il-settore-extralberghiero/",
      "https://radiotusciaevents.com/fu-turismo-roma-e-il-futuro-dellospitalita-extralberghiera/",
      "https://www.paeseroma.it/intrattenimento/eventi/2025/01/16/fu-turismo-roma-e-il-futuro-dellospitalita-extralberghiera/",
      "https://tr.ee/WMKKeaR3bt",
      "https://tr.ee/eW5Fn7NbPY",
    ],
  };

  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % evt.images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [evt.images.length]);

  return (
    <>
      <Head>
        <title>{evt.title} — Eventi F.E.N.A.M</title>
        <meta name="description" content={evt.excerpt} />
      </Head>

      <article className="mx-auto max-w-7xl px-6 py-16 grid gap-10 lg:grid-cols-12">
        {/* Left column: Description + Contacts + Links */}
        <section className="lg:col-span-6">
          <h1 className="text-4xl font-extrabold text-secondary mb-4">
            {evt.title}
          </h1>
          <p className="italic text-secondary/80 mb-6">{evt.subtitle}</p>
          <p className="text-secondary mb-6">
            <strong>Data:</strong> {evt.date}
            <br />
            <strong>Luogo:</strong> {evt.location}
          </p>

          {evt.description.map((p, i) => (
            <p key={i} className="mb-4 text-secondary">
              {p.replace(/^###\s*/, "")}
            </p>
          ))}

          <h2 className="mt-12 text-2xl font-bold text-secondary">Contatti</h2>
          <p className="mb-4 text-secondary/90">
            <strong>Sito:</strong>{" "}
            <a href={evt.contacts.sito} className="underline hover:text-primary">
              {evt.contacts.sito.replace("https://", "")}            
            </a>
            <br />
            <strong>Telefono:</strong> {evt.contacts.telefono}
            <br />
            <strong>Email:</strong>{" "}
            <a href={`mailto:${evt.contacts.email}`} className="underline hover:text-primary">
              {evt.contacts.email}
            </a>
          </p>

          <details className="mb-12">
            <summary className="cursor-pointer text-primary underline">
              Rassegna stampa &amp; link utili
            </summary>
            <ul className="list-disc pl-5 mt-4 space-y-2 text-secondary/90">
              {evt.links.map((l) => (
                <li key={l}>
                  <a
                    href={l}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary"
                  >
                    {l.replace(/https?:\/\//, "")}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </section>

        {/* Right column: Carousel, Program, Speakers */}
        <section className="lg:col-span-6">
          <div className="relative">
            <Image
              src={evt.images[current]}
              alt={`${evt.title} ${current + 1}`}
              width={800}
              height={450}
              className="w-full h-auto object-cover rounded-2xl mb-8"
              priority
            />
            <button
              onClick={() => setCurrent((current - 1 + evt.images.length) % evt.images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 backdrop-blur-sm rounded-full p-2"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => setCurrent((current + 1) % evt.images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 backdrop-blur-sm rounded-full p-2"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <h2 className="text-2xl font-bold text-secondary mb-4">Programma</h2>
          <ul className="list-disc pl-5 mb-8 text-secondary/90 space-y-2">
            {evt.program.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>

          <h2 className="text-2xl font-bold text-secondary mb-4">Relatori e Ospiti</h2>
          <ul className="list-disc pl-5 mb-8 text-secondary/90 space-y-1 columns-1 md:columns-2 lg:columns-2">
            {evt.speakers.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </article>

      <div className="max-w-7xl px-6 mb-16">
        <Link href="/eventi" className="text-primary hover:underline">
          ← Torna agli eventi
        </Link>
      </div>
    </>
  );
}
