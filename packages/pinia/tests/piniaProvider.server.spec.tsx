// @vitest-environment node
import { PassThrough } from 'node:stream'
import { Suspense } from 'react'
import { renderToPipeableStream, renderToString } from 'react-dom/server'
import { createPinia, defineStore, getActivePinia, PiniaProvider } from '../src'

const requestGetter = vi.fn((state: { user: string }) => state.user.toUpperCase())
const { useStore } = defineStore('request', {
  state: () => ({ user: '' }),
  getters: { normalizedUser: requestGetter }
})
function User() {
  const store = useStore()
  return (
    <span>
      {store.user}:{store.normalizedUser}
    </span>
  )
}

it('isolates server render snapshots and never writes request state to activePinia', () => {
  const active = createPinia()
  const alice = renderToString(
    <PiniaProvider initialStores={{ request: { user: 'alice' } }}>
      <User />
    </PiniaProvider>
  )
  expect(alice.replaceAll('<!-- -->', '')).toContain('alice:ALICE')
  expect(getActivePinia()).toBe(active)
  const bob = renderToString(
    <PiniaProvider initialStores={{ request: { user: 'bob' } }}>
      <User />
    </PiniaProvider>
  )
  expect(bob.replaceAll('<!-- -->', '')).toContain('bob:BOB')
  expect(requestGetter).toHaveBeenCalledTimes(2)
  expect(getActivePinia()).toBe(active)
  expect(active.state).toEqual({})
  expect(active._s.size).toBe(0)
})

it('resolves cross-store getters in the request Provider instead of the global active instance', () => {
  const active = createPinia()
  const { getStore: getSource } = defineStore('source', { state: () => ({ count: 0 }) })
  const { useStore: useDerived } = defineStore('derived', {
    state: () => ({}),
    getters: { double: () => getSource().count * 2 }
  })
  function Derived() {
    return <span>{useDerived().double}</span>
  }
  expect(
    renderToString(
      <PiniaProvider initialStores={{ source: { count: 5 } }}>
        <Derived />
      </PiniaProvider>
    )
  ).toContain('10')
  expect(active.state).toEqual({})
  expect(getActivePinia()).toBe(active)
})

it('registers server Provider plugins before store creation without changing activePinia', () => {
  const active = createPinia()
  const plugin = vi.fn(({ store, pinia }) => {
    expect(store.user).toBe('request')
    expect(pinia).not.toBe(active)
  })
  expect(
    renderToString(
      <PiniaProvider plugins={[plugin]} initialStores={{ request: { user: 'request' } }}>
        <User />
      </PiniaProvider>
    )
  ).toContain('request')
  expect(plugin).toHaveBeenCalledOnce()
  expect(getActivePinia()).toBe(active)
  expect(active.state).toEqual({})
})

it('isolates overlapping streaming requests, late stores and nested Providers including plugin effects', async () => {
  const active = createPinia()
  const { useStore: useLate } = defineStore('stream-request', {
    state: () => ({ user: 'default' }),
    getters: { label: (state) => state.user.toUpperCase() }
  })
  const instances = new Map<string, unknown>()
  const effects: string[] = []
  function begin(user: string) {
    let ready = false
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = () => {
        ready = true
        resolve()
      }
    })
    function Late() {
      if (!ready) throw gate
      const store = useLate()
      return (
        <b>
          {store.user}:{store.label}
        </b>
      )
    }
    function Inner() {
      return <i>{useLate().user}</i>
    }
    let shellReady!: () => void
    const shell = new Promise<void>((resolve) => {
      shellReady = resolve
    })
    const chunks: string[] = []
    const output = new PassThrough()
    const result = new Promise<string>((resolve, reject) => {
      output.on('data', (chunk) => chunks.push(String(chunk)))
      output.on('end', () => resolve(chunks.join('').replaceAll('<!-- -->', '')))
      output.on('error', reject)
      const stream = renderToPipeableStream(
        <PiniaProvider
          initialStores={{ 'stream-request': { user } }}
          plugins={[
            ({ pinia, store }) => {
              instances.set(user, pinia)
              effects.push(store.user)
            }
          ]}
        >
          <PiniaProvider
            initialStores={{ 'stream-request': { user: 'nested-' + user } }}
            plugins={[
              ({ pinia, store }) => {
                instances.set('nested-' + user, pinia)
                effects.push(store.user)
              }
            ]}
          >
            <Inner />
          </PiniaProvider>
          <Suspense fallback={<small>waiting</small>}>
            <Late />
          </Suspense>
        </PiniaProvider>,
        {
          onShellReady() {
            stream.pipe(output)
            shellReady()
          },
          onError: reject
        }
      )
    })
    return { release, result, shell }
  }
  const alice = begin('alice')
  const bob = begin('bob')
  await Promise.all([alice.shell, bob.shell])
  bob.release()
  const bobHtml = await bob.result
  expect(bobHtml).toContain('bob:BOB')
  expect(bobHtml).toContain('nested-bob')
  expect(bobHtml).not.toContain('alice')
  alice.release()
  const aliceHtml = await alice.result
  expect(aliceHtml).toContain('alice:ALICE')
  expect(aliceHtml).toContain('nested-alice')
  expect(aliceHtml).not.toContain('bob')
  expect(effects.sort()).toEqual(['alice', 'bob', 'nested-alice', 'nested-bob'])
  expect(new Set(instances.values()).size).toBe(4)
  expect(getActivePinia()).toBe(active)
  expect(active.state).toEqual({})
})

it('renders supplied Pinia state on the server without reinitialization or changing active Pinia', () => {
  const owner = createPinia()
  owner._initialStores.request = { user: 'owned' }
  const active = createPinia()
  const html = renderToString(
    <PiniaProvider pinia={owner}>
      <User />
    </PiniaProvider>
  )
  expect(html.replaceAll('<!-- -->', '')).toContain('owned:OWNED')
  expect(getActivePinia()).toBe(active)
  expect(owner.state.request).toEqual({ user: 'owned' })
})
