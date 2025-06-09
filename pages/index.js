import Head from 'next/head'
import Hero from '../components/Hero'
import SectorsShowcase from '../components/SectorsShowcase'
import ValoriSection from '../components/ValoriSection'
import ProjectsSection from '../components/ProjectsSection'
import EventsSection   from '../components/EventsSection'
import ContactNewsletter from '../components/ContactNewsletter'
import MissionSection from '../components/MissionSection'

export default function Home() {
  return (
    <>
      <Head><title>FENAM — Federazione Nazionale Associazioni Multiculturali</title></Head>
      
      <Hero />
      <MissionSection/>
      <SectorsShowcase />
      
      <ValoriSection />
      <ProjectsSection />
      <EventsSection /> 
      <ContactNewsletter />
    </>
  )
}
