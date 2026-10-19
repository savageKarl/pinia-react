/// <reference types="vite/client" />

import { defineStore, onStoreDebug, type Pinia } from 'pinia-react'
import { Profiler, useEffect, useState } from 'react'
import { Example } from '../../shared/playground'

export function createDiagnosticStores(pinia: Pinia) {
  const { getStore: getRate } = defineStore('diagnostic-rate', {
    state: () => ({ rate: 2 }),
    actions: {
      increment() {
        this.rate++
      }
    }
  })
  const { useStore: useDiagnosticStore, getStore: getDiagnosticStore } = defineStore('diagnostic-reader', {
    state: () => ({ count: 0, unused: 0, selected: 'left' as 'left' | 'right', fields: { left: 1, right: 10 } }),
    getters: {
      total(): number {
        return this.count * getRate(pinia).rate
      }
    },
    actions: {
      increment() {
        this.count++
      },
      changeUnread() {
        this.unused++
      },
      select() {
        this.selected = this.selected === 'left' ? 'right' : 'left'
      },
      changeRight() {
        this.fields.right++
      }
    }
  })

  return { useDiagnosticStore, getDiagnosticStore, getRate }
}

function Reader({
  caption,
  useDiagnosticStore
}: {
  caption: number
  useDiagnosticStore: ReturnType<typeof createDiagnosticStores>['useDiagnosticStore']
}) {
  const store = useDiagnosticStore('DiagnosticReader')
  return (
    <output>
      {caption}: selected {store.fields[store.selected]} · total {store.total}
    </output>
  )
}

export function DiagnosticsDemo({
  pinia,
  stores
}: {
  pinia: Pinia
  stores: ReturnType<typeof createDiagnosticStores>
}) {
  const { useDiagnosticStore, getRate } = stores
  const store = useDiagnosticStore()
  const [ready, setReady] = useState(false)
  const [caption, setCaption] = useState(0)
  useEffect(() => {
    const stop = import.meta.env.DEV ? onStoreDebug(pinia, (event) => console.debug('store-debug', event)) : undefined
    // Mount the labelled reader after its observer, including Strict Mode Effect replay.
    setReady(true)
    return stop
  }, [pinia])
  return (
    <Example
      number='05'
      title='Tracking diagnostics'
      description='Open the browser console at Debug/Verbose level. Store requests and React commits are separate observations.'
      file='DiagnosticsDemo.tsx'
      code={`const stop = onStoreDebug(pinia, event =>\n  console.debug('store-debug', event))\n\nconst store = useDiagnosticStore('DiagnosticReader')\n// Profiler onRender observes React commits separately.\n// stop() removes the debug listener, not subscriptions.`}
    >
      <p>No state values or Action arguments are logged. Paths and names may still be sensitive.</p>
      {ready && (
        <Profiler
          id='DiagnosticReader'
          onRender={(id, phase) => {
            if (import.meta.env.DEV) console.debug('react-commit', { id, phase })
          }}
        >
          <Reader caption={caption} useDiagnosticStore={useDiagnosticStore} />
        </Profiler>
      )}
      <div className='demo-actions'>
        <button onClick={() => store.increment()}>Increment count</button>
        <button onClick={() => store.changeUnread()}>Change unread field</button>
        <button onClick={() => store.select()}>Switch selected path</button>
        <button onClick={() => store.changeRight()}>Change right field</button>
        <button onClick={() => getRate(pinia).increment()}>Change cross-Store rate</button>
        <button onClick={() => setCaption((value) => value + 1)}>Change parent prop</button>
      </div>
      <p>
        An unread field has no Reader notify. A parent prop can commit with no Store notify; that alone does not
        identify a React render cause. Production diagnostics are off.
      </p>
    </Example>
  )
}
