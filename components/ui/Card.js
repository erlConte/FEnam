import Image from 'next/image'

export default function Card({ badge, icon, title, className = '', children }) {
  return (
    <article className={`fenam-card ${className}`}>
      {badge && (
        <div className="mb-6 flex items-center gap-2">
          <span className="rounded-full border border-secondary px-4 py-1 text-xs">
            {badge}
          </span>
          <span className="h-5 w-5 rounded-full border border-primary bg-primary" />
        </div>
      )}

      {icon && (
        <Image
          src={icon}
          alt=""
          width={32}
          height={32}
          priority
          className="absolute -right-0 -top-0 select-none"
        />
      )}

      {title && <h3 className="text-4xl font-extrabold leading-snug">{title}</h3>}
      {children}
    </article>
  )
}
