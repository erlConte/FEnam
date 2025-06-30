import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'

export default function ProgettiPage() {
  const projects = [
    {
      slug: 'DINOI',
      title: 'DINOI: Un Modello Innovativo di Eco-Gastronomia e Scambio Culturale',
      cover: '/img/DINOI.jpg',
      excerpt:
        'FENAM collabora con DINOI, ponte tra la tradizione italiana e il dinamismo latinoamericano, un progetto etico e tecnologico per un valore condiviso.',
    },
  ]

  return (
    <>
      <Head>
        <title>Progetti | FENAM</title>
      </Head>

      <section className="bg-paper py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="mb-12 text-5xl italic text-secondary">Progetti</h1>
          <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.slug}
                href={`/progetti/${p.slug}`}
                className="group block overflow-hidden rounded-2xl bg-white shadow hover:shadow-lg transition"
              >
                <div className="relative h-48">
                  <Image
                    src={p.cover}
                    alt={p.title}
                    fill
                    className="object-cover group-hover:scale-105 transition"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-secondary group-hover:text-primary transition">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm text-secondary/80">{p.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
