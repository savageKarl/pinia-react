// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createPinia, defineStore, getActivePinia, PiniaProvider } from '../src'

it('isolates overlapping request services and transfers only JSON snapshots into Providers', async () => {
  const { getStore: getRequestStore, useStore: useRequestStore } = defineStore('request-service', {
    state: () => ({ user: '' }),
    actions: {
      async load(owner: import('../src').Pinia, user: string, gate: Promise<void>) {
        await gate
        getRequestStore(owner).$patch({ user })
      }
    }
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const alice = createPinia()
  const first = getRequestStore(alice).load(alice, 'alice', gate)
  const bob = createPinia()
  await getRequestStore(bob).load(bob, 'bob', Promise.resolve())
  const active = createPinia()
  release()
  await first
  function User() {
    return <span>{useRequestStore().user}</span>
  }
  for (const [pinia, user] of [
    [alice, 'alice'],
    [bob, 'bob']
  ] as const) {
    const initialStores = JSON.parse(JSON.stringify(pinia.state))
    expect(initialStores).toEqual({ 'request-service': { user } })
    expect(
      renderToString(
        <PiniaProvider initialStores={initialStores}>
          <User />
        </PiniaProvider>
      )
    ).toContain(user)
  }
  expect(getActivePinia()).toBe(active)
  expect(active.state).toEqual({})
})

it('uses the same server snapshot for same-instance explicit cross-Store Getters', () => {
  const active = createPinia()
  const { getStore: getSourceStore } = defineStore('explicit-source', { state: () => ({ count: 0 }) })
  const { useStore: useDerivedStore } = defineStore('explicit-derived', {
    state: () => ({}),
    getters: {
      total(): number {
        return getSourceStore().count * 2
      }
    }
  })
  function Total() {
    return <span>{useDerivedStore().total}</span>
  }
  for (const count of [3, 7]) {
    expect(
      renderToString(
        <PiniaProvider initialStores={{ 'explicit-source': { count } }}>
          <Total />
        </PiniaProvider>
      )
    ).toContain(String(count * 2))
  }
  expect(getActivePinia()).toBe(active)
  expect(active.state).toEqual({})
})
