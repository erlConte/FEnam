// pages/supporto.js
import Head from 'next/head'
import Link from 'next/link'

export async function getServerSideProps() {
  // Email di contatto: usa CONTACT_EMAIL se disponibile, altrimenti fallback
  const contactEmail = process.env.CONTACT_EMAIL || 'info@fenam.website'
  
  return {
    props: {
      contactEmail,
    },
  }
}

export default function Supporto({ contactEmail }) {

  return (
    <>
      <Head>
        <title>Supporto | FENAM</title>
        <meta name="description" content="Contatta il supporto FENAM per assistenza" />
      </Head>

      {/* breadcrumb/title */}
      <div className="bg-paper">
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <p className="bullet-title text-secondary">Supporto</p>
        </div>
      </div>

      {/* Main content */}
      <section className="bg-paper pb-24 pt-10">
        <div className="mx-auto max-w-3xl px-6">
          <div className="space-y-6 rounded-3xl bg-white p-8 shadow-lg">
            <h1 className="text-3xl font-bold text-secondary">Supporto</h1>
            
            <div className="space-y-4 text-secondary/90">
              <p className="text-lg leading-relaxed">
                Se non sei stato reindirizzato a Enotempo, contattaci per assistenza.
              </p>
              
              <div className="rounded-lg bg-[#f9f9f9] p-6 border-l-4 border-[#8fd1d2]">
                <p className="font-semibold text-secondary mb-2">Email di contatto:</p>
                <p className="text-lg">
                  <a 
                    href={`mailto:${contactEmail}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {contactEmail}
                  </a>
                </p>
                <p className="text-sm text-secondary/70 mt-3">
                  Controlla anche la cartella Spam/Promozioni: la tessera può finire lì.
                </p>
              </div>

              <p className="text-sm text-secondary/70">
                Il nostro team ti risponderà il prima possibile.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Link
                href="/"
                className="inline-block rounded-lg bg-[#12A969] px-6 py-3 text-center text-white font-semibold hover:bg-[#0f8a55] transition-colors"
              >
                Torna alla Home
              </Link>
              
              <Link
                href="/affiliazione"
                className="inline-block rounded-lg bg-[#8fd1d2] px-6 py-3 text-center text-secondary font-semibold hover:bg-[#7fc1c2] transition-colors"
              >
                Pagina Affiliazione
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
