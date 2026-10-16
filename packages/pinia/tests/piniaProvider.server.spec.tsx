// @vitest-environment node
import { renderToString } from 'react-dom/server'
import { createPinia, defineStore, getActivePinia, PiniaProvider } from '../src'

const { useStore } = defineStore('request', { state: () => ({ user: '' }) })
function User() {
  return <span>{useStore().user}</span>
}

it('isolates server render snapshots and never writes request state to activePinia', () => {
  const active = createPinia()
  expect(
    renderToString(
      <PiniaProvider initialStores={{ request: { user: 'alice' } }}>
        <User />
      </PiniaProvider>
    )
  ).toContain('alice')
  expect(getActivePinia()).toBe(active)
  expect(
    renderToString(
      <PiniaProvider initialStores={{ request: { user: 'bob' } }}>
        <User />
      </PiniaProvider>
    )
  ).toContain('bob')
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
