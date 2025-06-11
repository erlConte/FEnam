import Link from 'next/link'
import Image from 'next/image'

export default function EventCard({ evt }) {
  return (
    <Link href={`/eventi/${evt.slug}`} className="block">
      <article className="overflow-hidden rounded-2xl bg-white shadow transition hover:shadow-lg">
        {evt.cover && (
          <Image
            src={evt.cover}
            alt={evt.title}
            width={600}
            height={350}
            className="h-48 w-full object-cover rounded-t-2xl"
          />
        )}
        <div className="p-6">
          <h3 className="text-xl font-semibold text-secondary mb-2">
            {evt.title}
          </h3>
          <p className="italic text-sm text-secondary/80 mb-2">
            {evt.subtitle}
          </p>
          <p className="text-sm text-secondary mb-4">
            <strong>Quando:</strong> {evt.date} · {evt.time}<br />
            <strong>Dove:</strong> {evt.location}
          </p>
          <p className="text-sm text-secondary/90 line-clamp-3">
            {evt.excerpt}
          </p>
        </div>
      </article>
    </Link>
  )
}