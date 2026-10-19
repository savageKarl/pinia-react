import { act, fireEvent, render } from '@testing-library/react'
import { createPinia, defineStore, getActivePinia, type MutationEvent, PiniaProvider } from '../src'

beforeEach(() => createPinia())
afterEach(() => vi.restoreAllMocks())

it('binds generic and named accessors without changing the active instance', () => {
  const { getStore, getExplicitStore } = defineStore('explicit', { state: () => ({ count: 0 }) })
  const first = createPinia()
  const second = createPinia()
  getStore(first).$patch({ count: 4 })
  expect(getExplicitStore(first)).toBe(getStore(first))
  expect(first._s.get('explicit')).toBe(getStore(first))
  expect(getStore(second)).toBe(second._s.get('explicit'))
  expect(getStore()).toBe(getStore(second))
  expect(getStore(undefined)).toBe(getStore())
  expect(getStore().count).toBe(0)
  expect(getActivePinia()).toBe(second)
})

it('passes Provider ownership to external services across independently mounted applications', () => {
  const { useStore, getStore } = defineStore('application', { state: () => ({ count: 0 }) })
  function Counter({ pinia }: { pinia: import('../src').Pinia }) {
    const store = useStore()
    return <button onClick={() => getStore(pinia).$patch({ count: store.count + 1 })}>{store.count}</button>
  }
  const firstOwner = createPinia()
  const secondOwner = createPinia()
  getStore(firstOwner).$patch({ count: 1 })
  getStore(secondOwner).$patch({ count: 8 })
  const first = render(
    <PiniaProvider pinia={firstOwner}>
      <Counter pinia={firstOwner} />
    </PiniaProvider>
  )
  const second = render(
    <PiniaProvider pinia={secondOwner}>
      <Counter pinia={secondOwner} />
    </PiniaProvider>
  )
  const unrelated = createPinia()
  fireEvent.click(first.container.querySelector('button')!)
  expect(first.container).toHaveTextContent('2')
  expect(second.container).toHaveTextContent('8')
  expect(getStore(unrelated).count).toBe(0)
  expect(getActivePinia()).toBe(unrelated)
})

it('tracks same-instance explicit Getter dependencies without notifying the other application', () => {
  const { getSourceStore } = defineStore('source', { state: () => ({ count: 1 }) })
  const calculate = vi.fn()
  const { useDerivedStore, getDerivedStore } = defineStore('derived', {
    state: () => ({}),
    getters: {
      double(): number {
        calculate()
        return getSourceStore().count * 2
      }
    }
  })
  function Derived() {
    return <span>{useDerivedStore().double}</span>
  }
  const first = render(
    <PiniaProvider>
      <Derived />
    </PiniaProvider>
  )
  const firstPinia = getActivePinia()
  const second = render(
    <PiniaProvider>
      <Derived />
    </PiniaProvider>
  )
  const secondPinia = getActivePinia()
  expect(calculate).toHaveBeenCalledTimes(2)
  act(() => getSourceStore(firstPinia).$patch({ count: 3 }))
  expect(first.container).toHaveTextContent('6')
  expect(second.container).toHaveTextContent('2')
  expect(calculate).toHaveBeenCalledTimes(3)
  expect(getDerivedStore(secondPinia).double).toBe(2)
  expect(getActivePinia()).toBe(secondPinia)
})

it('rejects a foreign instance inside a Getter before creating a Store or registering dependencies', () => {
  const foreign = createPinia()
  const owner = createPinia()
  const { getSourceStore } = defineStore('source', { state: () => ({ count: 1 }) })
  const { getDerivedStore } = defineStore('derived', {
    state: () => ({}),
    getters: {
      invalid: () => getSourceStore(foreign).count,
      valid: () => getSourceStore().count * 2,
      sameId(): number {
        return getDerivedStore(foreign).valid
      }
    }
  })
  const store = getDerivedStore(owner)
  expect(() => store.invalid).toThrow(/different Pinia instance/)
  expect(() => store.sameId).toThrow(/different Pinia instance/)
  expect(foreign._s.size).toBe(0)
  expect(foreign._scopes.size).toBe(0)
  expect(store.valid).toBe(2)
  expect(owner._scopes.get('source')!.subscribers.get('derived')).toEqual(new Set(['valid']))
  expect(getSourceStore(foreign).count).toBe(1)
  expect(foreign._scopes.get('source')!.subscribers.size).toBe(0)
  expect(getActivePinia()).toBe(owner)
})

it('keeps cross-Store Actions owned through await and interleaved calls', async () => {
  const { getOtherStore } = defineStore('other', {
    state: () => ({ count: 0 }),
    actions: {
      add(amount: number) {
        this.count += amount
      }
    }
  })
  const { getWorkerStore } = defineStore('worker', {
    state: () => ({ done: 0 }),
    actions: {
      async work(owner: import('../src').Pinia, gate: Promise<void>, amount: number) {
        getOtherStore(owner).add(amount)
        await gate
        getOtherStore(owner).add(amount)
        this.done++
      }
    }
  })
  const first = createPinia()
  const firstEvents: MutationEvent[] = []
  first.onMutation((event) => firstEvents.push(event))
  const second = createPinia()
  const secondEvents: MutationEvent[] = []
  second.onMutation((event) => secondEvents.push(event))
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const pending = getWorkerStore(first).work(first, gate, 1)
  await getWorkerStore(second).work(second, Promise.resolve(), 10)
  const active = createPinia()
  release()
  await pending
  expect(getOtherStore(first).count).toBe(2)
  expect(getOtherStore(second).count).toBe(20)
  expect(getWorkerStore(first).done).toBe(1)
  expect(getWorkerStore(second).done).toBe(1)
  expect(firstEvents.map((event) => event.storeId)).toEqual(['other', 'other', 'worker'])
  expect(secondEvents.map((event) => event.storeId)).toEqual(['other', 'other', 'worker'])
  expect(firstEvents.every((event) => event.store === first._s.get(event.storeId))).toBe(true)
  expect(secondEvents.every((event) => event.store === second._s.get(event.storeId))).toBe(true)
  expect(active.state).toEqual({})
  expect(getActivePinia()).toBe(active)
})
