import { useEffect, useState } from 'react'
import { CounterDemo, SharedCounterDemo } from '../../shared/counter'
import { type ExampleId, Playground } from '../../shared/playground'
import { PersistenceDemo } from './PersistenceDemo'

const examples = [
  { id: 'counter', label: 'State basics' },
  { id: 'sharing', label: 'Shared state' },
  { id: 'persistence', label: 'Local storage' }
] as const

function readExample(): ExampleId {
  return examples.find((example) => `#${example.id}` === window.location.hash)?.id ?? 'counter'
}

export function App() {
  const [active, setActive] = useState(readExample)
  useEffect(() => {
    const update = () => setActive(readExample())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  function select(example: ExampleId) {
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
    </Playground>
  )
}
