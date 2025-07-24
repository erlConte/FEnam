// components/ComunicatiCard.js
import Image from 'next/image'

export default function ComunicatiCard({ item, onOpen }) {
  return (
    <button
      className="group text-left"
      onClick={() => onOpen(item)}
      aria-label={`Apri ${item.title}`}
    >
      <div className="overflow-hidden rounded-2xl shadow-lg">
        <Image
          src={item.cover}
          alt=""
          width={800}
          height={600}
          className="h-48 w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <h3 className="mt-4 font-semibold text-secondary group-hover:text-primary">
        {item.title}
      </h3>
      <p className="text-xs text-secondary/70">{item.date}</p>
    </button>
  )
}
