import { act, renderHook } from '@testing-library/react'
import { createPinia, defineStore } from '../src'

function chain(length: number) {
  const source = defineStore('chain-source', { state: () => ({ count: 1 }) })
  let read = () => source.getStore().count * 2
  const stores = Array.from({ length }, (_, index) => {
    const previous = read
    const getter = vi.fn(previous)
    const definition = defineStore(`chain-${index}`, { state: () => ({}), getters: { value: getter } })
    read = () => definition.getStore().value + 1
    return { definition, getter }
  })
  return { source, stores }
}

it.each([1, 3, 8, 128])(
  'invalidates a %i-Store chain once, with consistent snapshots and no derived Mutations',
  (length) => {
    const pinia = createPinia()
    const { source, stores } = chain(length)
    const tail = stores[length - 1].definition
    const { result } = renderHook(() => tail.useStore().value)
    expect(result.current).toBe(length + 1)
    const before = stores.map(({ definition }) => definition.getStore(pinia).$state)
    const notifications = stores.map(({ definition }) => {
      const listener = vi.fn()
      pinia._scopes.get(definition.getStore(pinia).$id)!.listeners.add(listener)
      return listener
    })
    const mutation = vi.fn()
    pinia.onMutation(mutation)
    act(() => source.getStore(pinia).$patch({ count: 2 }))
    expect(result.current).toBe(length + 3)
    expect(mutation).toHaveBeenCalledOnce()
    expect(mutation.mock.calls[0][0].storeId).toBe('chain-source')
    stores.forEach(({ definition, getter }, index) => {
      const store = definition.getStore(pinia)
      expect(store.value).toBe(index + 4)
      expect(getter).toHaveBeenCalledTimes(2)
      expect(store.$state).not.toBe(before[index])
      expect(pinia.state[store.$id]).toBe(pinia._scopes.get(store.$id)!.currentState)
      expect(pinia.state[store.$id]).toEqual(store.$state)
      expect(notifications[index]).toHaveBeenCalledOnce()
      expect(notifications[index].mock.calls[0].slice(0, 3)).toEqual([store.$state, before[index], []])
    })
  }
)

it('invalidates both arms of an uneven diamond and local Getter chains before any reader can recompute', () => {
  const pinia = createPinia()
  const a = defineStore('diamond-A', {
    state: () => ({ count: 1 }),
    getters: { doubled: (state) => state.count * 2 }
  })
  const b = defineStore('diamond-B', { state: () => ({}), getters: { left: () => a.getStore().doubled } })
  const d = defineStore('diamond-D', { state: () => ({}), getters: { value: () => a.getStore().count * 10 } })
  const e = defineStore('diamond-E', { state: () => ({}), getters: { right: () => d.getStore().value + 1 } })
  const sum = vi.fn()
  const unrelated = vi.fn(() => 99)
  const c = defineStore('diamond-C', {
    state: () => ({}),
    getters: {
      left: () => b.getStore().left,
      right: () => e.getStore().right,
      sum(): number {
        sum()
        return this.left + this.right
      },
      unrelated
    }
  })
  const f = defineStore('diamond-F', { state: () => ({}), getters: { value: () => c.getStore().sum + 1 } })
  expect(f.getStore().value).toBe(14)
  expect(c.getStore().unrelated).toBe(99)
  const read = () => [a.getStore().doubled, c.getStore().left, c.getStore().right, c.getStore().sum, f.getStore().value]
  const observations: number[][] = []
  const notify = [a, b, d, e, c, f].map((definition) => {
    const listener = vi.fn(() => observations.push(read()))
    pinia._scopes.get(definition.getStore().$id)!.listeners.add(listener)
    return listener
  })
  const business = vi.fn(() => observations.push(read()))
  a.getStore().$subscribe(business)
  pinia.onMutation(business)
  // These Hooks run after the synchronous listeners above have already refilled every cache.
  const left = renderHook(() => c.useStore().left)
  const right = renderHook(() => c.useStore().right)
  const total = renderHook(() => f.useStore().value)
  act(() => a.getStore().$patch({ count: 2 }))
  expect(observations).toEqual(Array.from({ length: 8 }, () => [4, 4, 21, 25, 26]))
  expect(left.result.current).toBe(4)
  expect(right.result.current).toBe(21)
  expect(total.result.current).toBe(26)
  notify.forEach((listener) => expect(listener).toHaveBeenCalledOnce())
  expect(business).toHaveBeenCalledTimes(2)
  expect(sum).toHaveBeenCalledTimes(2)
  expect(c.getStore().unrelated).toBe(99)
  expect(unrelated).toHaveBeenCalledOnce()
})

it('terminates repeated and cyclic Store edges without cloning or notifying the source twice', () => {
  const pinia = createPinia()
  const a = defineStore('cycle-A', {
    state: () => ({ count: 1 }),
    getters: { viaB: (): number => b.getStore().value + a.getStore().count }
  })
  const b = defineStore('cycle-B', {
    state: () => ({}),
    getters: { value: () => a.getStore().count + a.getStore().count }
  })
  const c = defineStore('cycle-C', {
    state: () => ({}),
    getters: { value: () => a.getStore().viaB + b.getStore().value }
  })
  expect(c.getStore().value).toBe(5)
  const listeners = [a, b, c].map((definition) => {
    const listener = vi.fn()
    pinia._scopes.get(definition.getStore().$id)!.listeners.add(listener)
    return listener
  })
  const mutation = vi.fn()
  pinia.onMutation(mutation)
  a.getStore().$patch({ count: 2 })
  expect(c.getStore().value).toBe(10)
  expect(a.getStore().viaB).toBe(6)
  listeners.forEach((listener) => expect(listener).toHaveBeenCalledOnce())
  expect(mutation).toHaveBeenCalledOnce()
  expect(pinia._scopes.get(a.getStore().$id)!.currentState).toBe(mutation.mock.calls[0][0].state)
})

it('retains circular Getter warnings and terminates invalidation around a real Getter cycle', () => {
  createPinia()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const a = defineStore('getter-cycle-A', {
      state: () => ({ count: 1 }),
      getters: { value: (): number => (b.getStore().value ?? 0) + a.getStore().count }
    })
    const b = defineStore('getter-cycle-B', {
      state: () => ({}),
      getters: { value: (): number => (a.getStore().value ?? 0) + 1 }
    })
    expect(a.getStore().value).toBe(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Circular dependency detected in getter "value"'))
    a.getStore().$patch({ count: 2 })
    expect(a.getStore().value).toBe(3)
    expect(warn.mock.calls.length).toBeLessThan(10)
  } finally {
    warn.mockRestore()
  }
})

it('isolates identical multi-hop graphs across Pinia instances, even when another instance is active', () => {
  const first = createPinia()
  const { source, stores } = chain(4)
  const second = createPinia()
  const tail = stores[3].definition
  expect(tail.getStore(first).value).toBe(5)
  expect(tail.getStore(second).value).toBe(5)
  const snapshot = tail.getStore(second).$state
  const mutation = vi.fn()
  second.onMutation(mutation)
  source.getStore(first).$patch({ count: 3 })
  expect(tail.getStore(first).value).toBe(9)
  expect(tail.getStore(second).value).toBe(5)
  expect(tail.getStore(second).$state).toBe(snapshot)
  expect(mutation).not.toHaveBeenCalled()
})

it('propagates async Action writes, reset and plugin restore through the same multi-hop lifecycle', async () => {
  const pinia = createPinia()
  let restore!: () => void
  pinia.use(({ store, restoreState }) => {
    if (store.$id === 'lifecycle-A') restore = () => restoreState({ count: 7 }, { origin: 'devtools' })
  })
  const a = defineStore('lifecycle-A', {
    state: () => ({ count: 1 }),
    actions: {
      async increment() {
        this.count++
        await Promise.resolve()
        this.count++
      }
    }
  })
  const b = defineStore('lifecycle-B', { state: () => ({}), getters: { value: () => a.getStore().count * 2 } })
  const c = defineStore('lifecycle-C', { state: () => ({}), getters: { value: () => b.getStore().value + 1 } })
  const seen: number[] = []
  const events: { storeId: string; meta: { type: string; origin?: string; actionId?: string } }[] = []
  expect(c.getStore().value).toBe(3)
  pinia.onMutation((event) => {
    seen.push(c.getStore().value)
    events.push(event)
  })
  await a.getStore().increment()
  a.getStore().$reset()
  restore()
  expect(seen).toEqual([5, 7, 3, 15])
  expect(events.map((event) => event.storeId)).toEqual(Array(4).fill('lifecycle-A'))
  expect(events.map((event) => event.meta.type)).toEqual(['action', 'action', 'reset', 'restore'])
  expect(events[0].meta.actionId).toBe(events[1].meta.actionId)
  expect(events[3].meta.origin).toBe('devtools')
})
