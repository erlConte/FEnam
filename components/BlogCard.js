import Link from 'next/link'
import Image from 'next/image'

export default function BlogCard({ post }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow transition hover:shadow-lg">
      <Link href={`/blog/${post.slug}`}>
        <Image
          src={post.cover}
          alt=""
          width={600}
          height={350}
          className="h-52 w-full object-cover"
        />
      </Link>
      <div className="p-6">
        <h3 className="text-xl font-semibold text-secondary">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm text-secondary/80">{post.excerpt}</p>
        <time className="mt-3 block text-xs text-secondary/60">{post.date}</time>
      </div>
    </article>
  )
}
