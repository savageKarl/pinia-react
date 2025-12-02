import type { Metadata } from 'next'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'pinia-react for nextjs'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
