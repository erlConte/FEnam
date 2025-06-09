// components/Layout.js
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout({ children }) {
  return (
    <>
      {/* header scrolla insieme alla pagina */}
      <Navbar />

      {/* contenuto principale */}
      <main>{children}</main>

      {/* footer comune */}
      <Footer />
    </>
  )
}
