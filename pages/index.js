import Head from 'next/head'
import Hero from '../components/Hero'
import SectorsShowcase from '../components/SectorsShowcase'
import ValuesCarousel from '../components/ValuesCarousel'
import ContactNewsletter from '../components/ContactNewsletter'
import ProjectsSection from '../components/ProjectsSection'

export default function Home() {
  return (
    <>
      <Head><title>FENAM — Federazione Nazionale Associazioni Multiculturali</title></Head>

      <Hero />
      <SectorsShowcase />     {/* id="settori" */}
      <ValuesCarousel />      {/* id="valori" */}
      <ProjectsSection />   
      <ContactNewsletter />   {/* id="contatti" */}
        
    </>
  )
}
