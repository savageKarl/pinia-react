import Link from 'next/link'
import { App } from '../App'

export default function Details() {
  return (
    <>
      <Link href='/'>Back to home</Link>
      <App />
    </>
  )
}
