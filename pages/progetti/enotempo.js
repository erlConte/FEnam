// pages/progetti/enotempo.js
import { useState, useEffect } from 'react'
import Head   from 'next/head'
import Image  from 'next/image'
import Link   from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Flag,
  Phone,
} from 'lucide-react'

/* --------------- SLIDES ---------------- */
const slides = Array.from({ length: 8 }, (_, i) =>
  `/img/progetti/enotempo/slide-${i + 1}.jpg`
)

/* --------------- DATI EVENTO ----------- */
const evento = {
  titolo   : 'ENOTEMPO · Wine & Culture Experience',
  luogo    : 'Roma – Auditorium (TBD)',
  startISO : '2025-10-03T19:30:00',
  endISO   : '2025-10-03T23:00:00',
}

/* --------------- CONTATTO -------------- */
const contatto = {
  tel : '+39 351 313 1624',
  telLink: 'tel:+393513131624',
}

/* --------------- TESTI ----------------- */
const testi = {
  it: {
    chi: `ENOTEMPO è molto più di un progetto: un’esperienza multisensoriale nata dall’incontro fra <strong>vino</strong>, <strong>cultura</strong> e <strong>narrazione</strong>. Con i nostri format connettiamo le persone attraverso degustazioni, storie e territori.`,
  },
  es: {
    chi: `ENOTEMPO es mucho más que un proyecto: es una vivencia multisensorial donde <strong>vino</strong>, <strong>cultura</strong> y <strong>narrativa</strong> se encuentran. Creamos catas que despiertan los sentidos y conectan a las personas.`,
    mision : `<strong>Misión</strong> — Diseñamos experiencias donde el arte del maridaje se entrelaza con la cultura, la naturaleza y las personas.`,
    vision : `<strong>Visión</strong> — Consolidar una red de eventos en destinos emblemáticos del mundo, donde los productos de excelencia sean puentes entre culturas y sensaciones.`,
    valores: ['Autenticidad','Elegancia','Calidad','Cultura','Conexión'],
  },
}

/* --------------- MENU COMPLETO --------- */
const menu = {
  it: [
    {
      titolo: 'PALTA – antipasto',
      descr : `
Pan della casa / Palta / Salsa escabeche / Pomodoro / Pinoli / Basilico / Sale di Maras<br/>
<em>Un antipasto che unisce tradizione peruviana e tocchi mediterranei.</em><br/><br/>
<strong>Palta</strong>: avocado coltivato nelle valli andine, cremoso e nutriente.<br/>
<strong>Salsa escabeche</strong>: cipolla marinata in aceto e spezie, nota agrodolce.<br/>
<strong>Pomodoro &amp; basilico</strong>: ponte di sapori italo-peruviani.<br/>
<strong>Pinoli</strong>: croccantezza delicata.<br/>
<strong>Sale di Maras</strong>: cristalli minerali raccolti a 3 000 m nella Valle Sacra.`,
    },
    {
      titolo: 'AJÍ SECO – primo piatto',
      descr : `
Salsa di ají seco / Trota andina / Huacatay &amp; mais chullpi / Quinoa / Mousse di avocado<br/>
<em>Le Ande in ogni sfumatura.</em><br/><br/>
<strong>Ají seco</strong>: peperoncino essiccato dal gusto leggermente affumicato.<br/>
<strong>Trota</strong>: allevata in acque d’altopiano, delicata e saporita.<br/>
<strong>Huacatay</strong>: “mentuccia nera” peruviana.<br/>
<strong>Mais chullpi</strong>: tostato, fragrante.<br/>
<strong>Quinoa</strong>: il “grano degli Inca”, ricco di storia.<br/>
<strong>Mousse di palta</strong>: cremosità moderna che valorizza ingredienti ancestrali.`,
    },
    {
      titolo: 'CHINCHO & HUACATAY – secondo piatto',
      descr : `
Olluco / Patate andine / Carota / Fave / Choclo / Lomo di manzo marinato<br/>
<em>Celebrazione della terra e delle sue radici.</em><br/><br/>
<strong>Olluco</strong>: tubero andino dalla consistenza unica.<br/>
<strong>Patate dolci e patate locali</strong>: dolcezza &amp; struttura.<br/>
<strong>Choclo</strong>: mais gigante, dolce e granuloso.<br/>
<strong>Lomo di manzo</strong>: marinato in chincho e huacatay, erbe aromatiche balsamiche.`,
    },
    {
      titolo: 'MAÍZ MORADO – dolce',
      descr : `
Purè di mais morado / Ananas e fragole al forno / Cannella / Meringa / Pistacchio<br/>
<em>Dolcezza ancestrale e tecnica contemporanea.</em><br/><br/>
<strong>Maíz morado</strong>: varietà viola ricca di antociani.<br/>
<strong>Ananas &amp; fragole al forno</strong>: cottura lenta per esaltarne gli zuccheri.<br/>
<strong>Cannella</strong>: nota calda tipica dei dessert peruviani.<br/>
<strong>Meringa &amp; pistacchio</strong>: leggerezza e croccantezza per un finale elegante.`,
    },
  ],
  es: [
    {
      titulo: 'PALTA – entrante',
      descr : `
Pan de la casa / Palta / Salsa escabeche / Tomate / Piñones / Albahaca / Sal de Maras<br/>
<em>Fusión de tradición peruana y matices mediterráneos.</em><br/><br/>
<strong>Palta</strong>: aguacate andino cremoso.<br/>
<strong>Salsa escabeche</strong>: cebolla marinada agridulce.<br/>
<strong>Tomate &amp; albahaca</strong>: puente italo-peruano.<br/>
<strong>Piñones</strong>: toque crujiente.<br/>
<strong>Sal de Maras</strong>: cristales milenarios de los Andes.`,
    },
    {
      titulo: 'AJÍ SECO – primero',
      descr : `
Salsa de ají seco / Trucha andina / Huacatay &amp; maíz chullpi / Quinoa / Mousse de palta<br/>
<em>Los Andes en cada matiz.</em><br/><br/>
<strong>Ají seco</strong>: picante ahumado natural.<br/>
<strong>Trucha</strong>: crianza de altura, sabor delicado.<br/>
<strong>Huacatay</strong>: menta negra aromática.<br/>
<strong>Maíz chullpi</strong>: tostado y fragante.<br/>
<strong>Quinoa</strong>: “grano de los Incas”.<br/>
<strong>Mousse de palta</strong>: cremosidad contemporánea.`,
    },
    {
      titulo: 'CHINCHO & HUACATAY – segundo',
      descr : `
Olluco / Camote / Papas andinas / Zanahoria / Habas / Choclo / Lomo de res macerado<br/>
<em>Celebración de la tierra y sus raíces.</em><br/><br/>
<strong>Olluco</strong>: tubérculo andino acuoso y delicado.<br/>
<strong>Camote &amp; papas</strong>: dulzor y estructura.<br/>
<strong>Choclo</strong>: maíz gigante dulce.<br/>
<strong>Lomo de res</strong>: macerado en chincho y huacatay, hierbas balsámicas.`,
    },
    {
      titulo: 'MAÍZ MORADO – postre',
      descr : `
Puré de maíz morado / Piña &amp; fresas al horno / Canela / Merengue / Pistacho<br/>
<em>Dulzura ancestral y técnica contemporánea.</em><br/><br/>
<strong>Maíz morado</strong>: rico en antocianinas.<br/>
<strong>Fruta al horno</strong>: caramelización natural.<br/>
<strong>Canela</strong>: nota cálida clásica.<br/>
<strong>Merengue &amp; pistacho</strong>: ligereza y crocante final.`,
    },
  ],
}

/* --------------- ICS ------------------- */
function makeIcsUrl() {
  const pad = n => String(n).padStart(2, '0')
  const fmt = d =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  const s = new Date(evento.startISO)
  const e = new Date(evento.endISO)
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${evento.titolo}
DTSTART:${fmt(s)}
DTEND:${fmt(e)}
LOCATION:${evento.luogo}
END:VEVENT
END:VCALENDAR`
  return URL.createObjectURL(new Blob([ics],{type:'text/calendar'}))
}

/* =============== COMPONENTE =============== */
export default function EnotempoPage() {
  /* carosello */
  const [idx,setIdx] = useState(0)
  const prev =()=>setIdx(i=>(i-1+slides.length)%slides.length)
  const next =()=>setIdx(i=>(i+1)%slides.length)
  useEffect(()=>{const t=setInterval(next,6500);return()=>clearInterval(t)},[])

  /* lingua */
  const [lang,setLang]=useState('it')
  const t = testi[lang]

  /* ics */
  const [icsUrl,setIcsUrl] = useState(null)
  useEffect(()=>{
    const u = makeIcsUrl()
    setIcsUrl(u)
    return ()=> URL.revokeObjectURL(u)
  },[])

  /* data / orario */
  const s = new Date(evento.startISO)
  const e = new Date(evento.endISO)
  const dateFmt = s.toLocaleDateString(lang==='it'?'it-IT':'es-ES',{day:'numeric',month:'long',year:'numeric'})
  const timeFmt = `${s.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})} – ${e.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`

  return (
    <>
      <Head>
        <title>{evento.titolo} — Progetti FENAM</title>
        <meta name="description" content="Esperienza multisensoriale ENOTEMPO: vino, cultura, territorio."/>
      </Head>

      <article className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        {/* ---------- CAROSELLO ---------- */}
        <div className="relative aspect-video overflow-hidden rounded-2xl shadow-lg">
          <Image src={slides[idx]} alt={`Slide ${idx+1}`} fill className="object-cover" priority/>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur-md shadow"><ChevronLeft/></button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur-md shadow"><ChevronRight/></button>
        </div>

        {/* ---------- HEADER & CTA ---------- */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-secondary">{evento.titolo}</h1>
            <p className="mt-1 italic text-secondary/80">{dateFmt} · {timeFmt} · {evento.luogo}</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={()=>setLang(lang==='it'?'es':'it')} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-primary/10">
              <Flag className="h-4 w-4"/>{lang==='it'?'ES':'IT'}
            </button>
            {icsUrl && (
              <a href={icsUrl} download="enotempo.ics" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-semibold text-white shadow hover:bg-primary/90">
                <CalendarPlus size={18}/>{lang==='it'?'Aggiungi al calendario':'Añadir al calendario'}
              </a>
            )}
          </div>
        </div>

        {/* ---------- POSTI LIMITATI / INFO ---------- */}
        <div className="rounded-lg bg-primary/10 p-4 text-center font-semibold text-primary">
          {lang==='it'
            ? '🎉 Posti limitati — affrettati a prenotare!'
            : '🎉 Plazas limitadas — ¡reserva cuanto antes!'}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 rounded-xl border p-6 shadow-md">
          <p className="flex items-center gap-2 text-lg font-medium text-secondary">
            <Phone className="h-5 w-5 flex-shrink-0"/>{lang==='it'?'Info & prenotazioni':'Información & reservas'}:&nbsp;
            <a href={contatto.telLink} className="underline hover:text-primary">{contatto.tel}</a>
          </p>
          <p className="text-sm text-secondary/70">
            {lang==='it'
              ? 'Foto professionali in digitale in OMAGGIO'
              : 'Fotos profesionales digitales GRATIS'}
          </p>
        </div>

        {/* ---------- INTRO & (ES) MISSION/VISION ---------- */}
        <section className="space-y-8 leading-relaxed text-secondary">
          <p className="prose max-w-none" dangerouslySetInnerHTML={{__html:t.chi}} />
          {lang==='es' && (
            <>
              <p className="prose" dangerouslySetInnerHTML={{__html:testi.es.mision}} />
              <p className="prose" dangerouslySetInnerHTML={{__html:testi.es.vision}} />
              <div>
                <h3 className="mb-2 font-semibold">Valores</h3>
                <ul className="list-disc pl-6 space-y-1">{testi.es.valores.map(v=><li key={v}>{v}</li>)}</ul>
              </div>
            </>
          )}
        </section>

        {/* ---------- MENU CARD COMPLETO ---------- */}
        <div className="rounded-xl bg-[#faf7f1] p-8 shadow-inner space-y-6">
          <h2 className="text-2xl italic font-semibold">Menú “Tullpukuna” · Gluten-free</h2>
          <p className="text-secondary/80">
            {lang==='it'?'Opzione anche vegetariana.':'Disponible opción vegetariana.'}
          </p>

          <ul className="space-y-8">
            {menu[lang].map((p,i)=>(
              <li key={i} className="space-y-2">
                <p className="font-semibold">{p.titolo||p.titulo}</p>
                <p className="text-secondary/90" dangerouslySetInnerHTML={{__html:p.descr}} />
              </li>
            ))}
          </ul>

          <p className="mt-8 font-medium">
            {lang==='it'
              ? 'Biglietto: 80 € · Vini nazionali di eccellenza Made in Italy'
              : 'Entrada: 80 € · Vinos italianos de excelencia (Made in Italy)'}
          </p>
        </div>

        {/* ---------- BACK LINK ---------- */}
        <div className="pt-10">
          <Link href="/progetti" className="text-primary hover:underline">
            ← {lang==='it'?'Torna ai progetti':'Volver a proyectos'}
          </Link>
        </div>
      </article>
    </>
  )
}
