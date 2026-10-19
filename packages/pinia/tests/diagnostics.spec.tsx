import { act, fireEvent, render, screen } from '@testing-library/react'
import { Profiler, StrictMode, Suspense, startTransition, useState } from 'react'
import { createPinia, defineStore, onStoreDebug, type Pinia, type StoreDebugEvent } from '../src'

let pinia: Pinia
let events: StoreDebugEvent[]
let stop: () => void
beforeEach(() => {
  pinia = createPinia()
  events = []
  stop = onStoreDebug(pinia, (event) => events.push(event))
})
afterEach(() => {
  stop()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('reports committed reads and only actual onStoreChange requests, independently of React commits', () => {
  const { useStore, getStore } = defineStore('debug-paths', {
    state: () => ({ left: 0, right: 10, selected: 'left' as 'left' | 'right' })
  })
  const commits = vi.fn()
  function Reader({ caption }: { caption: string }) {
    const store = useStore('Reader')
    return (
      <output>
        {caption}:{store[store.selected]}
      </output>
    )
  }
  const profilerId = 'reader'
  const tree = (caption: string) => (
    <Profiler id={profilerId} onRender={commits}>
      <Reader caption={caption} />
    </Profiler>
  )
  const view = render(tree('initial'))
  expect(events.filter((event) => event.type === 'dependencies')).toEqual([
    { type: 'dependencies', storeId: 'debug-paths', label: 'Reader', statePaths: [['selected'], ['left']], getters: [] }
  ])
  events.length = 0
  act(() => getStore().$patch({ right: 11 }))
  expect(events.map((event) => event.type)).toEqual(['mutation'])
  expect(commits).toHaveBeenCalledOnce()
  view.rerender(tree('parent'))
  expect(commits).toHaveBeenCalledTimes(2)
  expect(events.filter((event) => event.type === 'notify')).toHaveLength(0)
  events.length = 0
  act(() => getStore().$patch({ selected: 'right' }))
  expect(screen.getByRole('status')).toHaveTextContent('parent:11')
  expect(events.find((event) => event.type === 'notify')).toMatchObject({
    storeId: 'debug-paths',
    label: 'Reader',
    reason: { kind: 'state-path', path: ['selected'] }
  })
  expect(events.findLast((event) => event.type === 'dependencies')).toMatchObject({
    statePaths: [['selected'], ['right']]
  })
  events.length = 0
  act(() => getStore().$patch({ left: 1 }))
  expect(events.map((event) => event.type)).toEqual(['mutation'])
})

it('describes Getter invalidation and whole-state reads without exposing values or Action arguments', () => {
  const { useStore, getStore } = defineStore('debug-private', {
    state: () => ({ count: 1, secret: 'private-state' }),
    getters: { double: (state) => state.count * 2 },
    actions: {
      set(secret: string) {
        this.secret = secret
        this.count++
      }
    }
  })
  function Reader() {
    return (
      <output>
        {useStore('Getter').double}:{useStore('State').$state.count}
      </output>
    )
  }
  render(<Reader />)
  expect(events.filter((event) => event.type === 'dependencies')).toEqual([
    { type: 'dependencies', storeId: 'debug-private', label: 'Getter', statePaths: [], getters: ['double'] },
    { type: 'dependencies', storeId: 'debug-private', label: 'State', statePaths: [['$state']], getters: [] }
  ])
  act(() => getStore().set('private-argument'))
  const mutations = events.filter((event) => event.type === 'mutation')
  expect(mutations).toHaveLength(2)
  expect(mutations[0].mutation.meta).toMatchObject({ type: 'action', action: 'set', actionId: expect.any(String) })
  expect(mutations[0].mutation.meta).not.toHaveProperty('args')
  expect(events.filter((event) => event.type === 'notify').map((event) => event.reason.kind)).toEqual([
    'all-state',
    'getter-invalidated',
    'all-state'
  ])
  const text = JSON.stringify(events)
  expect(text).not.toContain('private-state')
  expect(text).not.toContain('private-argument')
  for (const { mutation } of mutations) {
    expect(mutation).not.toHaveProperty('state')
    expect(mutation).not.toHaveProperty('prevState')
    expect(mutation).not.toHaveProperty('store')
    expect(mutation.patches.every((patch) => !Object.hasOwn(patch, 'value'))).toBe(true)
  }
})

it('keeps observer data detached and immutable, including dotted paths', () => {
  const { useStore, getStore } = defineStore('debug-detached', { state: () => ({ privateKey: 0, 'a.b': 0, other: 0 }) })
  const hostile = onStoreDebug(pinia, (event) => {
    if (event.type === 'dependencies') {
      expect(Reflect.set(event.statePaths[0], 0, 'other')).toBe(false)
      expect(Object.isFrozen(event.statePaths)).toBe(true)
    } else {
      expect(Reflect.set(event.mutation.patches[0].path, 0, 'other')).toBe(false)
      expect(Object.isFrozen(event.mutation.meta)).toBe(true)
      if (event.type === 'notify' && event.reason.kind === 'state-path') {
        expect(Reflect.set(event.reason.path, 0, 'other')).toBe(false)
      }
    }
  })
  function Reader() {
    const store = useStore('Dotted')
    return (
      <output>
        {store.privateKey}:{store['a.b']}
      </output>
    )
  }
  render(<Reader />)
  act(() =>
    getStore().$patch((draft) => {
      draft.privateKey++
      draft['a.b']++
    })
  )
  expect(screen.getByRole('status')).toHaveTextContent('1:1')
  expect(events.find((event) => event.type === 'mutation')?.mutation.patches.map((patch) => patch.path)).toContainEqual(
    ['privateKey']
  )
  events.length = 0
  act(() => getStore().$patch({ other: 1 }))
  expect(events.map((event) => event.type)).toEqual(['mutation'])
  hostile()
})

it('keeps the original Mutation source when a debug observer reenters another Store', () => {
  const source = defineStore('debug-outer', { state: () => ({ count: 0 }) })
  const nested = defineStore('debug-inner', { state: () => ({ count: 0 }) })
  function Reader() {
    return (
      <output>
        {source.useStore('Outer').count}:{nested.useStore('Inner').count}
      </output>
    )
  }
  render(<Reader />)
  const reenter = onStoreDebug(pinia, (event) => {
    if (event.type === 'mutation' && event.mutation.storeId === 'debug-outer') nested.getStore().$patch({ count: 5 })
  })
  act(() => source.getStore().$patch({ count: 1 }))
  const mutations = events.filter((event) => event.type === 'mutation')
  const notifications = events.filter((event) => event.type === 'notify')
  expect(mutations.map((event) => event.mutation.id)).toEqual([1, 2])
  expect(notifications.map((event) => [event.storeId, event.mutation.storeId, event.mutation.id])).toEqual([
    ['debug-inner', 'debug-inner', 2],
    ['debug-outer', 'debug-outer', 1]
  ])
  expect(screen.getByRole('status')).toHaveTextContent('1:5')
  reenter()
})

it('reports multi-hop cross-Store notifications with the original Mutation and complete forwarding chain', () => {
  const a = defineStore('debug-A', { state: () => ({ count: 1 }) })
  const b = defineStore('debug-B', { state: () => ({ unused: 0 }), getters: { fromA: () => a.getStore().count * 2 } })
  const c = defineStore('debug-C', { state: () => ({}), getters: { fromB: () => b.getStore().fromA + 1 } })
  function Reader() {
    return (
      <output>
        {b.useStore('B').fromA}:{c.useStore('C').fromB}
      </output>
    )
  }
  render(<Reader />)
  const business = vi.fn()
  const unsubscribe = pinia.onMutation(business)
  act(() => a.getStore().$patch({ count: 2 }))
  const notifications = events.filter((event) => event.type === 'notify')
  expect(notifications).toHaveLength(2)
  expect(notifications[0]).toMatchObject({
    storeId: 'debug-B',
    mutation: { id: 1, storeId: 'debug-A' },
    reason: { kind: 'getter-invalidated', getter: 'fromA' },
    via: [{ storeId: 'debug-B', getters: ['fromA'] }]
  })
  expect(business.mock.calls.map(([event]) => event.storeId)).toEqual(['debug-A'])
  expect(notifications[1]).toMatchObject({
    storeId: 'debug-C',
    mutation: { id: 1, storeId: 'debug-A' },
    reason: { kind: 'getter-invalidated', getter: 'fromB' },
    via: [
      { storeId: 'debug-B', getters: ['fromA'] },
      { storeId: 'debug-C', getters: ['fromB'] }
    ]
  })
  expect(screen.getByRole('status')).toHaveTextContent('4:5')
  events.length = 0
  act(() => b.getStore().$patch({ unused: 1 }))
  expect(events.find((event) => event.type === 'notify')).toMatchObject({
    storeId: 'debug-C',
    mutation: { id: 2, storeId: 'debug-B' },
    via: [{ storeId: 'debug-C', getters: ['fromB'] }]
  })
  expect(screen.getByRole('status')).toHaveTextContent('4:5')
  unsubscribe()
})

it('isolates debug callback failures but preserves errors in business Actions and mutation listeners', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const bad = onStoreDebug(pinia, () => {
    throw new Error('debug failure')
  })
  const { useStore, getStore } = defineStore('debug-errors', {
    state: () => ({ count: 0 }),
    actions: {
      fail() {
        this.count++
        throw new Error('business failure')
      }
    }
  })
  function Reader() {
    return <output>{useStore('Reader').count}</output>
  }
  render(<Reader />)
  expect(() => act(() => getStore().fail())).toThrow('business failure')
  expect(getStore().count).toBe(1)
  const unsubscribe = getStore().$subscribe(() => {
    throw new Error('business subscriber')
  })
  expect(() => act(() => getStore().$patch({ count: 2 }))).toThrow('business subscriber')
  expect(events.filter((event) => event.type === 'notify')).toHaveLength(2)
  expect(warn).toHaveBeenCalled()
  unsubscribe()
  bad()
})

it('keeps the committed label and dependencies across a suspended render and Strict Mode Effect replay', async () => {
  const { useStore, getStore } = defineStore('debug-concurrent', { state: () => ({ left: 0, right: 10 }) })
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  let blocked = true
  function Reader() {
    const [right, setRight] = useState(false)
    const store = useStore(right ? 'Right' : 'Left')
    const value = right ? store.right : store.left
    if (right && blocked) throw ready
    return <button onClick={() => startTransition(() => setRight(true))}>{value}</button>
  }
  render(
    <StrictMode>
      <Suspense fallback={<i>waiting</i>}>
        <Reader />
      </Suspense>
    </StrictMode>
  )
  expect(events.filter((event) => event.type === 'dependencies')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button'))
  events.length = 0
  act(() => getStore().$patch({ right: 11 }))
  expect(events.map((event) => event.type)).toEqual(['mutation'])
  act(() => getStore().$patch({ left: 1 }))
  expect(events.filter((event) => event.type === 'notify').map((event) => event.label)).toEqual(['Left'])
  expect(events.filter((event) => event.type === 'dependencies').every((event) => event.label === 'Left')).toBe(true)
  await act(async () => {
    blocked = false
    release()
  })
  expect(screen.getByRole('button')).toHaveTextContent('11')
  expect(events.findLast((event) => event.type === 'dependencies')).toMatchObject({
    label: 'Right',
    statePaths: [['right']]
  })
  events.length = 0
  act(() => getStore().$patch({ left: 2 }))
  expect(events.map((event) => event.type)).toEqual(['mutation'])
})

it('allocates no diagnostic IDs while off or in production, and leaves unlabelled Hooks unchanged', () => {
  const { useStore, getStore } = defineStore('debug-off', { state: () => ({ count: 0 }) })
  function Reader() {
    return <output>{useStore().count}</output>
  }
  render(<Reader />)
  act(() => getStore().$patch({ count: 1 }))
  expect(events.map((event) => event.type)).toEqual(['mutation'])
  expect(events[0]).toMatchObject({ mutation: { id: 1 } })
  stop()
  act(() => getStore().$patch({ count: 2 }))
  expect(events).toHaveLength(1)
  vi.stubEnv('NODE_ENV', 'production')
  const production = vi.fn()
  const stopProduction = onStoreDebug(pinia, production)
  act(() => getStore().$patch({ count: 3 }))
  expect(production).not.toHaveBeenCalled()
  stopProduction()
  vi.unstubAllEnvs()
  stop = onStoreDebug(pinia, (event) => events.push(event))
  act(() => getStore().$patch({ count: 4 }))
  expect(events[1]).toMatchObject({ type: 'mutation', mutation: { id: 2 } })
  expect(screen.getByRole('status')).toHaveTextContent('4')
})

it('scopes debug listeners to their Pinia and preserves restore origins', () => {
  const foreign = createPinia()
  const otherEvents = vi.fn()
  const unsubscribe = onStoreDebug(foreign, otherEvents)
  const definition = defineStore('same-id', { state: () => ({ count: 0 }) })
  let restore!: () => void
  pinia.use(({ restoreState }) => {
    restore = () => restoreState({ count: 4 }, { origin: 'devtools' })
  })
  definition.getStore(pinia)
  restore()
  expect(events[0]).toMatchObject({
    type: 'mutation',
    mutation: { storeId: 'same-id', meta: { type: 'restore', origin: 'devtools' } }
  })
  expect(otherEvents).not.toHaveBeenCalled()
  definition.getStore(foreign).$patch({ count: 2 })
  expect(otherEvents).toHaveBeenCalledOnce()
  unsubscribe()
  definition.getStore(foreign).$patch({ count: 3 })
  expect(otherEvents).toHaveBeenCalledOnce()
})
it('publishes debug callbacks after caches and business notifications settle, including reentrant writes', () => {
  const a = defineStore('debug-cache-A', {
    state: () => ({ count: 1 }),
    getters: { double: (state) => state.count * 2 }
  })
  const b = defineStore('debug-cache-B', { state: () => ({}), getters: { fromA: () => a.getStore().double + 1 } })
  expect(a.getStore().double).toBe(2)
  expect(b.getStore().fromA).toBe(3)
  const business: number[] = []
  a.getStore().$subscribe((state) => business.push(state.count))
  const seen: number[][] = []
  const unsubscribe = onStoreDebug(pinia, (event) => {
    if (event.type !== 'mutation' || event.mutation.storeId !== 'debug-cache-A') return
    seen.push([a.getStore().count, a.getStore().double, b.getStore().fromA])
    if (event.mutation.id === 1) a.getStore().$patch({ count: 3 })
  })
  a.getStore().$patch({ count: 2 })
  expect(seen).toEqual([
    [2, 4, 5],
    [3, 6, 7]
  ])
  expect(business).toEqual([2, 3])
  expect(a.getStore().double).toBe(6)
  expect(b.getStore().fromA).toBe(7)
  unsubscribe()
})

it('does not let a throwing host console turn a debug callback error into a business failure', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {
    throw new Error('host console failed')
  })
  const bad = onStoreDebug(pinia, () => {
    throw new Error('observer failed')
  })
  const store = defineStore('debug-host-console', { state: () => ({ count: 0 }) }).getStore()
  expect(() => store.$patch({ count: 1 })).not.toThrow()
  expect(store.count).toBe(1)
  bad()
})

it('retains asynchronous, nested and failed Action metadata without arguments in debug descriptions', async () => {
  const { getStore } = defineStore('debug-actions', {
    state: () => ({ count: 0 }),
    actions: {
      increment() {
        this.count++
      },
      async delayed(ready: Promise<void>) {
        this.count++
        await ready
        this.increment()
      },
      fail() {
        this.count++
        throw new Error('intentional')
      }
    }
  })
  const committed: { action?: string; actionId?: string; parentActionId?: string }[] = []
  const unsubscribe = pinia.onMutation((event) => committed.push(event.meta))
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  const pending = getStore().delayed(ready)
  getStore().increment()
  release()
  await pending
  expect(() => getStore().fail()).toThrow('intentional')
  const mutations = events.filter((event) => event.type === 'mutation').map((event) => event.mutation)
  expect(mutations.map((event) => event.id)).toEqual([1, 2, 3, 4])
  expect(mutations.map((event) => event.meta.action)).toEqual(['delayed', 'increment', 'increment', 'fail'])
  expect(mutations[2].meta.parentActionId).toBe(mutations[0].meta.actionId)
  expect(mutations[1].meta.parentActionId).toBeUndefined()
  expect(mutations.map((event) => event.meta.actionId)).toEqual(committed.map((meta) => meta.actionId))
  expect(mutations.every((event) => !Object.hasOwn(event.meta, 'args'))).toBe(true)
  expect(getStore().count).toBe(4)
  unsubscribe()
})

it.each(['off', 'production'])(
  'does not allocate diagnostic descriptions for multi-hop forwarding in %s mode',
  (mode) => {
    if (mode === 'off') stop()
    else vi.stubEnv('NODE_ENV', 'production')
    const a = defineStore('debug-no-allocation', { state: () => ({ count: 0 }) })
    const store = a.getStore()
    const b = defineStore('debug-no-allocation-B', {
      state: () => ({}),
      getters: { value: () => a.getStore().count * 2 }
    })
    const c = defineStore('debug-no-allocation-C', {
      state: () => ({}),
      getters: { value: () => b.getStore().value + 1 }
    })
    expect(c.getStore().value).toBe(1)
    const freeze = vi.spyOn(Object, 'freeze')
    store.$patch({ count: 1 })
    expect(freeze).not.toHaveBeenCalled()
    expect(c.getStore().value).toBe(3)
    expect(events).toHaveLength(0)
  }
)

it.each(['reader', 'mutation'] as const)(
  'keeps per-Getter forwarding sources intact across a nested %s write',
  (phase) => {
    const a = defineStore('reentrant-A', {
      state: () => ({ count: 1 }),
      getters: { doubled: (state) => state.count * 2 }
    })
    const x = defineStore('reentrant-X', { state: () => ({ count: 10 }) })
    const b = defineStore('reentrant-B', {
      state: () => ({}),
      getters: { fromA: () => a.getStore().doubled, fromX: () => x.getStore().count }
    })
    const c = defineStore('reentrant-C', {
      state: () => ({}),
      getters: { total: () => b.getStore().fromA + b.getStore().fromX }
    })
    expect(c.getStore().total).toBe(12)
    const seen: number[][] = []
    const reenter = () => {
      seen.push([a.getStore().doubled, b.getStore().fromA, c.getStore().total])
      x.getStore().$patch({ count: 20 })
      seen.push([a.getStore().doubled, b.getStore().fromA, c.getStore().total])
    }
    if (phase === 'reader') pinia._scopes.get('reentrant-A')!.listeners.add(reenter)
    else a.getStore().$subscribe(reenter)
    const business = vi.fn()
    pinia.onMutation(business)
    function Reader() {
      return (
        <output>
          {b.useStore('B-A').fromA}:{b.useStore('B-X').fromX}:{c.useStore('C').total}
        </output>
      )
    }
    render(<Reader />)
    act(() => a.getStore().$patch({ count: 2 }))
    expect(seen).toEqual([
      [4, 4, 14],
      [4, 4, 24]
    ])
    expect(screen.getByRole('status')).toHaveTextContent('4:20:24')
    expect(business.mock.calls.map(([event]) => event.storeId)).toEqual(['reentrant-X', 'reentrant-A'])
    const notifications = events.filter((event) => event.type === 'notify')
    expect(notifications).toHaveLength(4)
    for (const [id, source, getter, label] of [
      [1, 'reentrant-A', 'fromA', 'B-A'],
      [2, 'reentrant-X', 'fromX', 'B-X']
    ] as const) {
      const fromB = { storeId: 'reentrant-B', getters: [getter] }
      expect(notifications).toContainEqual(
        expect.objectContaining({
          label,
          mutation: expect.objectContaining({ id, storeId: source }),
          via: [fromB]
        })
      )
      expect(notifications).toContainEqual(
        expect.objectContaining({
          label: 'C',
          mutation: expect.objectContaining({ id, storeId: source }),
          via: [fromB, { storeId: 'reentrant-C', getters: ['total'] }]
        })
      )
    }
  }
)

it('keeps distinct diagnostic paths for different Getters when diamond branches reach the same Store', () => {
  const a = defineStore('debug-diamond-A', { state: () => ({ count: 1 }) })
  const b = defineStore('debug-diamond-B', { state: () => ({}), getters: { value: () => a.getStore().count * 2 } })
  const d = defineStore('debug-diamond-D', { state: () => ({}), getters: { value: () => a.getStore().count * 10 } })
  const e = defineStore('debug-diamond-E', { state: () => ({}), getters: { value: () => d.getStore().value + 1 } })
  const c = defineStore('debug-diamond-C', {
    state: () => ({}),
    getters: { left: () => b.getStore().value, right: () => e.getStore().value }
  })
  function Reader() {
    return (
      <output>
        {c.useStore('Left').left}:{c.useStore('Right').right}
      </output>
    )
  }
  render(<Reader />)
  act(() => a.getStore().$patch({ count: 2 }))
  const notifications = events.filter((event) => event.type === 'notify')
  expect(notifications).toHaveLength(2)
  expect(notifications[0]).toMatchObject({
    label: 'Left',
    mutation: { id: 1, storeId: 'debug-diamond-A' },
    via: [
      { storeId: 'debug-diamond-B', getters: ['value'] },
      { storeId: 'debug-diamond-C', getters: ['left'] }
    ]
  })
  expect(notifications[1]).toMatchObject({
    label: 'Right',
    mutation: { id: 1, storeId: 'debug-diamond-A' },
    via: [
      { storeId: 'debug-diamond-D', getters: ['value'] },
      { storeId: 'debug-diamond-E', getters: ['value'] },
      { storeId: 'debug-diamond-C', getters: ['right'] }
    ]
  })
  expect(screen.getByRole('status')).toHaveTextContent('4:21')
})
