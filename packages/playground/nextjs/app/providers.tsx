'use client'

import { createPinia } from 'pinia-react'
import type React from 'react'
import { localStoragePlugin } from './localStoragePlugin'

const pinia = createPinia()

pinia.use(({ store, id }) => {
  ;(store as any).secretKey = `SECRET_${id.toUpperCase()}`
  store.$subscribe(() => {
    console.log(`[PersistencePlugin] Saving state for ${id}`)
  })
})

pinia.use(localStoragePlugin)

export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
