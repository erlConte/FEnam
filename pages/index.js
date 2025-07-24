import Head from 'next/head'
import Hero from '../components/Hero'
import SectorsShowcase from '../components/SectorsShowcase'
import ValoriSection from '../components/ValoriSection'
import ContactNewsletter from '../components/ContactNewsletter'
import MissionSection from '../components/MissionSection'
import { comunicati } from './comunicati'           // relativo a pages/
import ComunicatiSection from '../components/ComunicatiSection'

export default function Home() {
  return (
    <>
      <Head><title>FENAM — Federazione Nazionale Associazioni Multiculturali</title></Head>
      <Hero />
      <MissionSection/>
      <SectorsShowcase />
      <ValoriSection />
      <ComunicatiSection items={comunicati.slice(0,3)} />
      <ContactNewsletter />
    </>
  )
}
