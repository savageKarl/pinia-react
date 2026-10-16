'use client'

import type { CookieSnapshot } from '@pinia-react/persistedstate/next'
import { createCookiePersistedState } from '@pinia-react/persistedstate/next'
import type { PiniaInitialStores } from 'pinia-react'
import { PiniaProvider } from 'pinia-react/next'
import { type ReactNode, useState } from 'react'

export default function Providers({
  children,
  cookies,
  initialStores
}: {
  children: ReactNode
  cookies: CookieSnapshot
  initialStores: PiniaInitialStores
}) {
  const [persistence] = useState(() =>
    createCookiePersistedState({
      cookies,
      cookieOptions: { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 }
    })
  )
  return (
    <PiniaProvider plugins={[persistence]} initialStores={initialStores}>
      {children}
    </PiniaProvider>
  )
}
