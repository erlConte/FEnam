// components/Navbar.js
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { useRouter } from 'next/router'

const nav = [
  { href: '/about',      label: 'Chi Siamo' },
  { href: '/#settori',   label: 'I Nostri Settori' },
  { href: '/progetti',  label: 'Progetti' },
  { href: '/eventi',     label: 'Eventi' },
  { href: '/affiliazione', label: 'Affiliazione' },
  { href: '/blog',       label: 'Blog' },
  { href: '/comunicati', label: 'Comunicati' },
]

function NavLink({ href, label, close, active }) {
  return (
    <Link
      href={href}
      onClick={close}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-4 py-1 text-sm font-medium transition
        ${active ? 'bg-primary/10 text-primary' : 'bg-white text-secondary'}
        hover:bg-primary/10`}
    >
      {label}
    </Link>
  )
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <header className="relative z-20 bg-paper">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/img/LOGO-FENAM-14.png"
            alt="FENAM"
            width={300}
            height={100}
            priority
          />
        </Link>

        {/* desktop menu: solo da xl in su */}
        <ul className="hidden items-center gap-4 xl:flex">
          {nav.map((l) => (
            <li key={l.href}>
              <NavLink
                {...l}
                close={() => {}}
                active={router.asPath === l.href}
              />
            </li>
          ))}
          <li>
            <Link
              href="/#contatti"
              className="rounded-full bg-primary px-4 py-1 text-sm font-semibold text-white shadow hover:bg-primary/90"
            >
              ● Contattaci
            </Link>
          </li>
        </ul>

        {/* burger button: visibile fino a <xl */}
        <button onClick={() => setOpen(true)} className="xl:hidden">
          <Menu size={28} />
        </button>
      </nav>

      {/* overlay mobile/tablet/desktop fino a <xl */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-white">
          <button
            aria-label="chiudi menu"
            onClick={() => setOpen(false)}
            className="absolute right-6 top-6"
          >
            <X size={32} />
          </button>

          {nav.map((l) => (
            <NavLink
              key={l.href}
              {...l}
              close={() => setOpen(false)}
              active={router.pathname === l.href || router.asPath === l.href}
            />
          ))}

          <Link
            href="/#contatti"
            onClick={() => setOpen(false)}
            className="rounded-full bg-primary px-6 py-2 font-semibold text-white"
          >
            Contattaci
          </Link>
        </div>
      )}
    </header>
  )
}
