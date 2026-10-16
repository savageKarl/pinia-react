import '../../shared/playground.css'
import { readCookieSnapshot } from '@pinia-react/persistedstate/next'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { preferenceCookieKeys, preferenceDefaults } from './persistence'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'pinia-react · Next.js playground',
  description: 'Three small examples of server state, shared state across pages, and cookie persistence.'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const snapshot = readCookieSnapshot(await cookies(), preferenceCookieKeys)
  return (
    <html lang='en'>
      <body>
        <Providers
          cookies={snapshot}
          initialStores={{ counter: { count: 10 }, preferences: { ...preferenceDefaults } }}
        >
          {children}
        </Providers>
      </body>
    </html>
  )
}
