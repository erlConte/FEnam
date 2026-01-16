import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function AffiliazioneSuccess() {
  const router = useRouter()
  const { orderId } = router.query

  return (
    <>
      <Head>
        <title>Affiliazione Completata | FENAM</title>
      </Head>

      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <div className="rounded-3xl bg-green-50 p-12 shadow-lg">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1 className="mb-4 text-3xl font-bold text-secondary">
            Affiliazione Completata!
          </h1>

          <p className="mb-6 text-lg text-secondary/80">
            Grazie per esserti affiliato a FENAM. La tua richiesta è stata
            processata con successo.
          </p>

          {orderId && (
            <p className="mb-8 rounded-lg bg-white p-4 text-sm text-secondary/70">
              <span className="font-semibold">ID Ordine:</span> {orderId}
            </p>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="rounded-full bg-primary px-6 py-3 font-semibold text-white shadow hover:bg-primary/90"
            >
              Torna alla Home
            </Link>
            <Link
              href="/about"
              className="rounded-full bg-white px-6 py-3 font-semibold text-secondary shadow hover:bg-gray-50"
            >
              Scopri di più
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
