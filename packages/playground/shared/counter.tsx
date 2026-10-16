'use client'

import { defineStore } from 'pinia-react'
import type { ReactNode } from 'react'
import { Example, StatePreview } from './playground'

export const { useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: (state) => state.count * 2 },
  actions: {
    increment() {
      this.count++
    }
  }
})

const counterCode = `export const { useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: {
    double: (state) => state.count * 2
  },
  actions: {
    increment() {
      this.count++
    }
  }
})

// Use inside a component
const counter = useCounterStore()
counter.increment()`

export function CounterDemo({ server = false }: { server?: boolean }) {
  const counter = useCounterStore()
  return (
    <Example
      number='01'
      title={server ? 'Start with server state.' : 'One click. One state update.'}
      description={
        server
          ? 'The server starts the counter at 10. Every click after that runs in the browser.'
          : 'Update state with an action. The getter stays in sync without extra setState calls.'
      }
      file='shared/counter.tsx'
      code={
        server
          ? `// layout.tsx: set the initial state for this request
<Providers initialStores={{ counter: { count: 10 } }}>
  {children}
</Providers>

// The store definition is the same as in React
${counterCode}`
          : counterCode
      }
    >
      <div className='counter-demo'>
        <span className='mini-label'>{server ? 'SERVER → BROWSER' : 'YOUR FIRST STORE'}</span>
        <output className='counter-value' data-testid='counter-value' aria-live='polite'>
          {counter.count}
        </output>
        <div className='derived-value'>
          double <span>=</span> <output data-testid='counter-double'>{counter.double}</output>
          <span className='derived-caption'>Calculated by a getter</span>
        </div>
        <div className='button-row'>
          <button className='button-primary' type='button' onClick={() => counter.increment()}>
            +1 <span aria-hidden='true'>+</span>
          </button>
          <button className='button-secondary' type='button' onClick={() => counter.$reset()}>
            Reset to 0
          </button>
        </div>
        <p className='demo-hint'>
          {server
            ? 'The initial value comes from layout.tsx; $reset() returns the store to its default of 0.'
            : 'Click a few times, then explore the store definition alongside the demo.'}
        </p>
      </div>
      <StatePreview state={counter.$state} />
    </Example>
  )
}

function CounterCard({ label }: { label: 'A' | 'B' }) {
  const counter = useCounterStore()
  return (
    <div className='shared-card'>
      <span className='component-label'>Component {label}</span>
      <output data-testid='shared-value' aria-live='polite'>
        {counter.count}
      </output>
      <button className='button-secondary' type='button' onClick={() => counter.increment()}>
        Component {label}: +1
      </button>
    </div>
  )
}

export function SharedCounterDemo({ children }: { children?: ReactNode }) {
  return (
    <Example
      number='02'
      title='Two components. One shared state.'
      description='Both components call the same useStore. Update either one and watch the other stay in sync.'
      file='shared/counter.tsx'
      code={`function CounterCard() {
  const counter = useCounterStore()

  return (
    <button onClick={() => counter.increment()}>
      {counter.count}
    </button>
  )
}

// Two components, one store
<CounterCard />
<CounterCard />`}
    >
      <div className='shared-demo'>
        <span className='mini-label'>ONE STORE. TWO COMPONENTS.</span>
        <div className='shared-grid'>
          <CounterCard label='A' />
          <CounterCard label='B' />
        </div>
        <p className='demo-hint'>No prop drilling. No duplicate state.</p>
        {children}
      </div>
    </Example>
  )
}
