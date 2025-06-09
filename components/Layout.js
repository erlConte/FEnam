// components/Layout.js
import Navbar from './Navbar'
import Footer from './Footer'

export default function Layout({ children }) {
    return (
      <div className="bg-paper min-h-screen flex flex-col">
        <Navbar />
  
        {/* 
          il main prende tutto lo spazio rimasto (flex-grow)
          e eredita lo sfondo cream dal wrapper 
        */}
        <main className="flex-grow">
          {children}
        </main>
  
        <Footer />
      </div>
    )
  }
