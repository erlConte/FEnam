import Head from 'next/head'
import BlogCard from '../../components/BlogCard'

const posts = [
  {
    slug: 'imprenditoria-latina',
    title:
      "L'Imprenditoria Latina in Italia: Un Motore di Crescita Economica e Culturale",
    date: '16 Marzo 2025',
    cover: '/img/blog/imprenditoria-latina.jpg',
    excerpt:
      'Negli ultimi decenni l’Italia ha visto crescere il contributo degli imprenditori latino-americani, ridefinendo mercati e cultura…',
  },
  {
    slug: 'abbracciando-diversita',
    title: 'Abbracciando la Diversità: il futuro della moda',
    date: '10 Giugno 2025',
    cover: '/img/blog/pozzanghera.jpg',
    excerpt:
      'La moda è sempre stata un riflesso della società, un mezzo per esprimere la nostra identità e la nostra visione del mondo...',
  },
]

export default function Blog() {
  return (
    <>
      <Head><title>Blog | FENAM</title></Head>

      <section className="bg-paper py-24">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="mb-12 text-5xl italic text-secondary">Blog</h1>

          <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <BlogCard key={p.slug} post={p} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
