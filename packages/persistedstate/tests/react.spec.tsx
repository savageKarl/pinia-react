import { act, fireEvent, render, screen } from '@testing-library/react'
import { createPinia, defineStore, getActivePinia, type PiniaPluginContext, PiniaProvider } from 'pinia-react'
import { StrictMode } from 'react'
import { createPersistedState } from '../src'
import { memoryStorage } from './helpers'

it('restores state and getters before the first SPA render, keeps path tracking, and does not hydrate on rerender', () => {
  const storage = memoryStorage({ react: '{"count":4}' })
  const plugin = createPersistedState({ storage })
  const { useStore } = defineStore('react', {
    state: () => ({ count: 0, unrelated: 0 }),
    persist: true,
    getters: { double: (s) => s.count * 2 }
  })
  let renders = 0
  let captured!: ReturnType<typeof useStore>
  function Counter() {
    renders++
    const store = useStore()
    captured = store
    return (
      <button onClick={() => store.$patch({ count: store.count + 1 })}>
        {store.count}:{store.double}
      </button>
    )
  }
  const view = render(
    <PiniaProvider plugins={[plugin]}>
      <Counter />
    </PiniaProvider>
  )
  expect(screen.getByRole('button')).toHaveTextContent('4:8')
  const before = renders
  act(() => captured.$patch({ unrelated: 1 }))
  expect(renders).toBe(before)
  expect(storage.setItem).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('5:10')
  view.rerender(
    <PiniaProvider plugins={[plugin]}>
      <Counter />
    </PiniaProvider>
  )
  expect(storage.getItem).toHaveBeenCalledOnce()
  expect(storage.setItem).toHaveBeenCalledTimes(2)
  expect(getActivePinia().state.react).toEqual({ count: 5, unrelated: 1 })
})

it('supports lazy stores and multiple isolated Provider trees with distinct keys', () => {
  const storage = memoryStorage({ first: '{"count":1}', second: '{"count":9}' })
  const { useStore } = defineStore('provider-counter', { state: () => ({ count: 0 }), persist: true })
  function Counter() {
    const store = useStore()
    return <button onClick={() => store.$patch({ count: store.count + 1 })}>{store.count}</button>
  }
  const firstPlugin = createPersistedState({ storage, key: () => 'first' })
  const first = render(
    <PiniaProvider plugins={[firstPlugin]}>
      <span>waiting</span>
    </PiniaProvider>
  )
  expect(storage.getItem).not.toHaveBeenCalled()
  first.rerender(
    <PiniaProvider plugins={[firstPlugin]}>
      <Counter />
    </PiniaProvider>
  )
  const firstPinia = getActivePinia()
  const second = render(
    <PiniaProvider plugins={[createPersistedState({ storage, key: () => 'second' })]}>
      <Counter />
    </PiniaProvider>
  )
  expect(getActivePinia()).not.toBe(firstPinia)
  fireEvent.click(first.getByText('1'))
  expect(first.getByText('2')).toBeInTheDocument()
  expect(second.getByText('9')).toBeInTheDocument()
  expect(storage.values.get('first')).toBe('{"count":2}')
  expect(storage.values.get('second')).toBe('{"count":9}')
})

it('does not duplicate live subscriptions under StrictMode; remount creates a fresh instance and restores again', () => {
  const storage = memoryStorage({ strict: '{"count":2}' })
  const instances: PiniaPluginContext[] = []
  const plugin = createPersistedState({ storage })
  const { useStore } = defineStore('strict', { state: () => ({ count: 0 }), persist: true })
  function Counter() {
    const store = useStore()
    return <button onClick={() => store.$patch({ count: store.count + 1 })}>{store.count}</button>
  }
  const tree = (
    <StrictMode>
      <PiniaProvider
        plugins={[
          plugin,
          (context) => {
            instances.push(context)
          }
        ]}
      >
        <Counter />
      </PiniaProvider>
    </StrictMode>
  )
  const first = render(tree)
  const live = getActivePinia()
  expect(storage.setItem).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('3')
  expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('strict', '{"count":3}')
  expect(instances.filter((context) => context.pinia === live)).toHaveLength(1)
  first.unmount()
  render(tree)
  expect(getActivePinia()).not.toBe(live)
  expect(screen.getByRole('button')).toHaveTextContent('3')
  fireEvent.click(screen.getByRole('button'))
  expect(storage.setItem).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button')).toHaveTextContent('4')
})

it('does not pause another Pinia while one instance is hydrating', () => {
  const storage = memoryStorage()
  const plugin = createPersistedState({ storage })
  createPinia().use(plugin)
  const other = defineStore('other', { state: () => ({ count: 0 }), persist: true }).getStore()
  createPinia().use(plugin)
  defineStore('hydrating', {
    state: () => ({ count: 0 }),
    persist: {
      beforeHydrate() {
        other.$patch({ count: 1 })
      }
    }
  }).getStore()
  expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('other', '{"count":1}')
})

it('merges saved fields after the complete Provider snapshot, without reintroducing omitted defaults', () => {
  const storage = memoryStorage({ snapshot: '{"profile":{"name":"local"}}' })
  const { useStore } = defineStore('snapshot', {
    state: (): { count: number; profile: { name: string }; legacy?: boolean } => ({
      count: 0,
      profile: { name: 'default' },
      legacy: true
    }),
    persist: true
  })
  let state: unknown
  function Snapshot() {
    const store = useStore()
    state = store.$state
    return (
      <span>
        {store.profile.name}:{store.count}
      </span>
    )
  }
  const initialStores = { snapshot: { count: 8, profile: { name: 'server' } } }
  render(
    <PiniaProvider initialStores={initialStores} plugins={[createPersistedState({ storage })]}>
      <Snapshot />
    </PiniaProvider>
  )
  expect(screen.getByText('local:8')).toBeInTheDocument()
  expect(state).toEqual({ count: 8, profile: { name: 'local' } })
  expect(initialStores.snapshot.profile.name).toBe('server')
  expect(storage.setItem).not.toHaveBeenCalled()
})
