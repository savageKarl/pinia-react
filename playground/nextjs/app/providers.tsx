'use client'

import { createPinia } from '../../../src'

const pinia = createPinia()

export default function Providers({ children }) {
  return <>{children}</>
}
