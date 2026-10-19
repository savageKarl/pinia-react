import {
  defineStore,
  onStoreDebug,
  type Pinia,
  type PiniaPlugin,
  PiniaProvider,
  type StoreDebugEvent
} from 'pinia-react'
import { StrictMode, Suspense, useEffect } from 'react'

const { useStore, getStore } = defineStore('browser-hydration', {
  state: () => ({ count: 1, profile: { name: 'initial' } }),
  getters: {
    double: (state) => state.count * 2,
    label(): string {
      return this.double + ':' + this.profile.name
    }
  },
  actions: {
    increment() {
      this.count++
    }
  }
})
const { useStore: useDerived } = defineStore('browser-derived', {
  state: () => ({}),
  getters: { fromOther: () => getStore().label }
})

export function createFixture(client: boolean) {
  let blocked = client
  let resolve!: () => void
  const gate = new Promise<void>((ready) => {
    resolve = ready
  })
  const observed: string[] = []
  const plugins: string[] = []
  const instances = new Set<unknown>()
  const debug: StoreDebugEvent[] = []
  const observers = new Map<Pinia, () => void>()
  const plugin: PiniaPlugin = ({ pinia, id }) => {
    instances.add(pinia)
    if (client && !observers.has(pinia))
      observers.set(
        pinia,
        onStoreDebug(pinia, (event) => debug.push(event))
      )
    plugins.push(id)
  }
  function Early() {
    const store = useStore('Early')
    useEffect(() => {
      store.$patch({ count: 5, profile: { name: 'new' } })
    }, [store.$patch])
    return (
      <button id='update' onClick={() => store.increment()}>
        {store.count}:{store.label}
      </button>
    )
  }
  function Delayed() {
    if (blocked) throw gate
    const store = useStore('Delayed')
    const derived = useDerived('DelayedDerived')
    const value = [store.count, store.$state.profile.name, store.double, store.label, derived.fromOther].join('|')
    observed.push(value)
    return <p id='delayed'>{value}</p>
  }
  function Isolated() {
    return <p id='isolated'>{useStore().count}</p>
  }
  const tree = (
    <StrictMode>
      <PiniaProvider
        plugins={[plugin]}
        initialStores={{ 'browser-hydration': { count: 1, profile: { name: 'initial' } } }}
      >
        <Early />
        <Suspense fallback={<i>waiting</i>}>
          <Delayed />
        </Suspense>
      </PiniaProvider>
      <PiniaProvider
        plugins={[plugin]}
        initialStores={{ 'browser-hydration': { count: 9, profile: { name: 'other' } } }}
      >
        <Isolated />
      </PiniaProvider>
    </StrictMode>
  )
  return {
    tree,
    observed,
    plugins,
    instances,
    debug,
    stopDebug() {
      observers.forEach((stop) => stop())
    },
    release() {
      blocked = false
      resolve()
    }
  }
}
