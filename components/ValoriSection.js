import Image from 'next/image'
import Card from './ui/Card'

const VALORI = [
  { title: 'Accogliente', body: 'Crediamo in una società che abbraccia la diversità, promuovendo la realizzazione personale e la crescita collettiva. Ogni persona è un tassello fondamentale nel mosaico della nostra società.' },
  { title: 'Rispetto', body: 'Rispettiamo e celebriamo i valori e le tradizioni di ogni cultura rappresentata nella nostra federazione. La diversità è la nostra forza e il rispetto reciproco è alla base delle nostre interazioni.' },
  { title: 'Collaborazione', body: 'Crediamo che la collaborazione sia la chiave per creare opportunità concrete che migliorino la qualità della vita nelle nostre comunità. La sinergia tra culture diverse e le nostre associazioni è essenziale per affrontare le sfide che ci troviamo a fronteggiare.' },
  { title: 'Innovazione', body: "Promuoviamo l'innovazione e il progresso attraverso iniziative che stimolino la creatività e l'imprenditorialità. Siamo convinti che, creando spazi e opportunità, possiamo ispirare nuove idee e sostenere progetti imprenditoriali che rispondano alle esigenze delle nostre comunità." },
  { title: 'Sostenibilità', body: 'Promuoviamo pratiche sostenibili che garantiscano uno sviluppo equo e responsabile, rispettando l\'ambiente e le risorse del nostro pianeta. La sostenibilità non è solo un obiettivo, ma un impegno concreto verso il presente e il futuro.' },
]

export default function ValoriSection() {
  return (
    <section id="valori" className="relative isolate bg-night/80 py-32">
      <Image
        src="/img/valori-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center opacity-40 -z-10"
      />

      <div className="mx-auto max-w-7xl px-6">
        {/* Mobile & Tablet: 1 card per riga */}
        <div className="grid grid-cols-1 gap-12 justify-items-center lg:hidden">
          {VALORI.map((v) => (
            <div key={v.title} className="w-80">
              <Card badge="I Nostri Valori" icon="/img/FENAM-ICON.png" title={v.title}>
                <p className="mt-4 text-sm leading-relaxed text-secondary/90">
                  {v.body}
                </p>
              </Card>
            </div>
          ))}
        </div>

        {/* Desktop (≥lg): 2 card sulla prima riga, 3 sulla seconda */}
        <div className="hidden lg:flex flex-col gap-12">
          <div className="flex justify-center gap-6">
            {VALORI.slice(0, 2).map((v) => (
              <div key={v.title} className="w-80 flex-shrink-0">
                <Card badge="I Nostri Valori" icon="/img/FENAM-ICON.png" title={v.title}>
                  <p className="mt-4 text-sm leading-relaxed text-secondary/90">
                    {v.body}
                  </p>
                </Card>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-6">
            {VALORI.slice(2).map((v) => (
              <div key={v.title} className="w-80 flex-shrink-0">
                <Card badge="I Nostri Valori" icon="/img/FENAM-ICON.png" title={v.title}>
                  <p className="mt-4 text-sm leading-relaxed text-secondary/90">
                    {v.body}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}