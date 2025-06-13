// pages/_app.js
import '../styles/globals.css'

import Layout from '../components/Layout'
import { useRouter } from 'next/router'
import { AnimatePresence, motion } from 'framer-motion'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { Analytics } from '@vercel/analytics/react'

export default function MyApp({ Component, pageProps }) {
  const router = useRouter()

  return (
    <Layout>
      {/* transition fra le pagine */}
      <AnimatePresence mode="wait">
        <motion.div
          key={router.route}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.25 }}
        >
          <Component {...pageProps} />
        </motion.div>
      </AnimatePresence>

      {/* notifiche newsletter / form */}
      <ToastContainer position="bottom-right" />
      
      {/* Analytics di Vercel */}
      <Analytics />
    </Layout>
  )
}
