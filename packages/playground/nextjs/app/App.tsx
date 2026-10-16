'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CounterDemo, SharedCounterDemo } from '../../shared/counter'
import { type ExampleId, Playground } from '../../shared/playground'
import { CookiePreferences } from './preferences'

const examples = [
  { id: 'counter', label: 'Server state', href: '/' },
  { id: 'sharing', label: 'Across pages', href: '/sharing' },
  { id: 'persistence', label: 'Cookie storage', href: '/preferences' }
] as const

export function App({ example = 'counter', details = false }: { example?: ExampleId; details?: boolean }) {
  const router = useRouter()
  return (
    <Playground
      framework='Next.js'
      navigation={examples.map((item, index) => (
        <Link key={item.id} href={item.href} aria-current={example === item.id ? 'page' : undefined}>
          <span className='nav-number'>0{index + 1}</span>
          {item.label}
        </Link>
      ))}
    >
      {example === 'counter' && <CounterDemo server />}
      {example === 'sharing' && (
        <SharedCounterDemo>
          <div className='route-demo'>
            <span className='route-label'>{details ? 'Currently on /details' : 'Currently on /sharing'}</span>
            <p>Visit another page and come back. The Provider in the root layout keeps your count.</p>
            <div className='button-row'>
              <Link className='button-primary' href={details ? '/sharing' : '/details'}>
                {details ? 'Back to shared state' : 'Open another page'} <span aria-hidden='true'>→</span>
              </Link>
              <button className='button-secondary' type='button' onClick={() => router.refresh()}>
                Refresh server data
              </button>
            </div>
          </div>
        </SharedCounterDemo>
      )}
      {example === 'persistence' && <CookiePreferences />}
    </Playground>
  )
}
