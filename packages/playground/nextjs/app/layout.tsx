import type { Metadata } from 'next'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'pinia-react for nextjs'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Replace this plain JSON source with a request-specific database or API query.
  const initialStores = await Promise.resolve({
    main: { count: 10, user: { name: 'Server User', level: 1 } }
  })
  return (
    <html lang='en'>
      <body>
        <Providers initialStores={initialStores}>{children}</Providers>
      </body>
    </html>
  )
}
