import type { Pinia } from 'pinia-react'
import { useEffect, useState } from 'react'
import { CounterDemo, SharedCounterDemo } from '../../shared/counter'
import { type ExampleId, Playground } from '../../shared/playground'
import { CheckoutComparison } from './CheckoutComparison'
import { ComparisonDemo } from './ComparisonDemo'
import { createDiagnosticStores, DiagnosticsDemo } from './DiagnosticsDemo'
import { PersistenceDemo } from './PersistenceDemo'

const examples = [
  { id: 'counter', label: 'State basics' },
  { id: 'sharing', label: 'Shared state' },
  { id: 'persistence', label: 'Local storage' },
  { id: 'comparison', label: 'Comparison lab' },
  { id: 'diagnostics', label: 'Tracking diagnostics' },
  { id: 'checkout', label: 'Business checkout' }
] as const

type ReactExampleId = ExampleId | 'comparison' | 'diagnostics' | 'checkout'

function readExample(): ReactExampleId {
  return examples.find((example) => `#${example.id}` === window.location.hash)?.id ?? 'counter'
}

export function App({ pinia }: { pinia: Pinia }) {
  const [diagnostics] = useState(() => createDiagnosticStores(pinia))
  const [active, setActive] = useState(readExample)
  useEffect(() => {
    const update = () => setActive(readExample())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  function select(example: ReactExampleId) {
    window.history.replaceState(null, '', `#${example}`)
    setActive(example)
  }
  return (
    <Playground
      framework='React'
      navigation={examples.map((example, index) => (
        <button key={example.id} type='button' aria-pressed={active === example.id} onClick={() => select(example.id)}>
          <span className='nav-number'>0{index + 1}</span>
          {example.label}
        </button>
      ))}
    >
      {active === 'counter' && <CounterDemo />}
      {active === 'sharing' && <SharedCounterDemo />}
      {active === 'persistence' && <PersistenceDemo />}
      {active === 'comparison' && <ComparisonDemo />}
      {active === 'diagnostics' && <DiagnosticsDemo pinia={pinia} stores={diagnostics} />}
      {active === 'checkout' && <CheckoutComparison />}
    </Playground>
  )
}
