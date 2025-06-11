import { Facebook, Linkedin, Twitter, Youtube } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t bg-gray-50 py-10 text-center text-sm text-gray-600">
      <p className="mb-3">
        Termini e condizioni&nbsp;|&nbsp;Informativa sulla privacy&nbsp;|&nbsp;
        Dichiarazione di accessibilità
      </p>
      <p className="mb-3">| C.F. 96628930586</p>
      
      <div className="mb-3 flex justify-center gap-4">
        <a href="#" aria-label="LinkedIn" className="hover:text-primary">
          <Linkedin size={20} />
        </a>
        <a href="#" aria-label="X" className="hover:text-primary">
          <Twitter size={20} />
        </a>
        <a href="#" aria-label="Facebook" className="hover:text-primary">
          <Facebook size={20} />
        </a>
        <a href="#" aria-label="YouTube" className="hover:text-primary">
          <Youtube size={20} />
        </a>
      </div>
      
      <p className="text-xs">
        © 2025 FENAM&nbsp;— Federazione Nazionale Associazioni Multiculturali
      </p>
    </footer>
  )
}
