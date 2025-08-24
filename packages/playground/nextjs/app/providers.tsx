'use client'

import { createPinia } from 'pinia-react'

const pinia = createPinia()

export default function Providers({ children }) {
  return <>{children}</>
}
