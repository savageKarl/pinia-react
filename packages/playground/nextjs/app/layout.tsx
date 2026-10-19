import '../../shared/playground.css'
import { readCookieSnapshot } from '@pinia-react/persistedstate/next'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { shippingKey } from '../../shared/checkoutDomain'
import { preferenceCookieKeys, preferenceDefaults } from './persistence'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'pinia-react · Next.js playground',
  description: 'Small examples of server state, shared state across pages, cookie persistence and checkout.'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const snapshot = readCookieSnapshot(await cookies(), [...preferenceCookieKeys, shippingKey])
  return (
    <html lang='en'>
      <body>
        <Providers
          cookies={snapshot}
          initialStores={{
            counter: { count: 10 },
            preferences: { ...preferenceDefaults },
            'checkout-cart': { quantity: 1 },
            'checkout-inventory': { stock: 3 },
            'checkout-preferences': { shipping: 'pickup', address: '' }
          }}
        >
          {children}
        </Providers>
      </body>
    </html>
  )
}
