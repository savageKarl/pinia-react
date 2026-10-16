import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { createPinia, defineStore, getActivePinia, PiniaProvider } from '../src'

const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0, profile: { name: 'default' } }),
  actions: {
    increment() {
      this.count++
    }
  }
})

function Counter() {
  const store = useCounterStore()
  return (
    <button onClick={() => store.increment()}>
      {store.count}:{store.profile.name}
    </button>
  )
}

describe('PiniaProvider', () => {
  beforeEach(() => createPinia())

  it('prefers Context over active Pinia and retains the instance across rerenders', () => {
    const initialStores = { counter: { count: 4, profile: { name: 'server' } } }
    const view = render(
      <PiniaProvider initialStores={initialStores}>
        <Counter />
      </PiniaProvider>
    )
    const instance = getActivePinia()
    expect(getCounterStore().count).toBe(4)
    fireEvent.click(screen.getByRole('button'))
    const unrelated = createPinia()
    expect(getCounterStore().count).toBe(0)
    expect(getActivePinia()).toBe(unrelated)
    view.rerender(
      <PiniaProvider initialStores={{ counter: { count: 99, profile: { name: 'new' } } }}>
        <Counter />
      </PiniaProvider>
    )
    expect(screen.getByRole('button')).toHaveTextContent('5:server')
    expect(getActivePinia()).toBe(instance)
    expect(getCounterStore().count).toBe(5)
    expect(initialStores.counter.count).toBe(4)
  })

  it('uses Context even when active Pinia is replaced by a sibling', () => {
    render(
      <PiniaProvider initialStores={{ counter: { count: 7, profile: { name: 'context' } } }}>
        <Counter />
        <ReplaceActive />
      </PiniaProvider>
    )
    const external = getActivePinia()
    expect(getCounterStore().count).toBe(0)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('8:context')
    expect(getActivePinia()).toBe(external)
  })

  it('falls back to active Pinia outside a Provider', () => {
    getCounterStore().$patch({ count: 3 })
    render(<Counter />)
    expect(screen.getByRole('button')).toHaveTextContent('3:default')
    fireEvent.click(screen.getByRole('button'))
    expect(getCounterStore().count).toBe(4)
  })

  it('consumes snapshots lazily once and runs plugins after initialization', () => {
    const { useStore: useLazy } = defineStore('lazy', { state: () => ({ count: 0 }) })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PiniaProvider initialStores={{ lazy: { count: 8 } }}>{children}</PiniaProvider>
    )
    const { result } = renderHook(() => getActivePinia(), { wrapper })
    const pinia = result.current
    expect(pinia._s.size).toBe(0)
    const plugin = vi.fn(({ store, pinia: instance, id }) => {
      expect(store.count).toBe(8)
      expect(instance.state[id]).toEqual({ count: 8 })
      expect(instance._s.get(id)).toBe(store)
    })
    pinia.use(plugin)
    const hook = renderHook(() => useLazy())
    expect(hook.result.current.count).toBe(8)
    expect(plugin).toHaveBeenCalledTimes(1)
    expect(pinia._initialStores).toEqual({})
    act(() => hook.result.current.$reset())
    expect(hook.result.current.count).toBe(0)
  })

  it('uses defaults for stores absent from the snapshot and replaces complete snapshots', () => {
    const { useStore } = defineStore('partial-container', { state: () => ({ count: 2 }) })
    const view = renderHook(() => useStore(), {
      wrapper: ({ children }) => <PiniaProvider initialStores={{ other: {} }}>{children}</PiniaProvider>
    })
    expect(view.result.current.count).toBe(2)
    expect(getActivePinia().state['partial-container']).toEqual({ count: 2 })
  })

  it('uses a complete snapshot without merging omitted optional defaults', () => {
    const { useStore } = defineStore('replace-snapshot', {
      state: (): { count: number; legacy?: boolean } => ({ count: 0, legacy: true })
    })
    const hook = renderHook(() => useStore(), {
      wrapper: ({ children }) => (
        <PiniaProvider initialStores={{ 'replace-snapshot': { count: 8 } }}>{children}</PiniaProvider>
      )
    })
    expect(hook.result.current.$state).toEqual({ count: 8 })
    expect(hook.result.current.legacy).toBeUndefined()
  })

  it('keeps independently mounted Provider trees isolated in StrictMode', () => {
    const first = render(
      <StrictMode>
        <PiniaProvider initialStores={{ counter: { count: 1, profile: { name: 'first' } } }}>
          <Counter />
        </PiniaProvider>
      </StrictMode>
    )
    const firstPinia = getActivePinia()
    const second = render(
      <PiniaProvider initialStores={{ counter: { count: 9, profile: { name: 'second' } } }}>
        <Counter />
      </PiniaProvider>
    )
    expect(getActivePinia()).not.toBe(firstPinia)
    fireEvent.click(first.getByText('1:first'))
    expect(first.getByText('2:first')).toBeInTheDocument()
    expect(second.getByText('9:second')).toBeInTheDocument()
  })

  it('hydrates the same snapshot without warnings and keeps client mutations', async () => {
    const tree = (
      <PiniaProvider initialStores={{ counter: { count: 6, profile: { name: 'ssr' } } }}>
        <Counter />
      </PiniaProvider>
    )
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    document.body.append(container)
    const recoverable = vi.fn()
    let root!: ReturnType<typeof hydrateRoot>
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: recoverable })
    })
    fireEvent.click(container.querySelector('button')!)
    expect(container).toHaveTextContent('7:ssr')
    expect(recoverable).not.toHaveBeenCalled()
    await act(async () => root.unmount())
    container.remove()
  })
})

function ReplaceActive() {
  createPinia()
  return null
}

it('registers initialization plugins before stores, once per instance, and ignores changed plugin props', () => {
  const events: string[] = []
  const plugin = vi.fn(({ store, pinia, id }) => {
    events.push(id)
    expect(pinia.state[id]).toEqual(store.$state)
    expect(store.count).toBe(4)
  })
  const changed = vi.fn()
  const { useStore } = defineStore('plugin-lazy', { state: () => ({ count: 0 }) })
  function Lazy() {
    return <span>{useStore().count}</span>
  }
  const view = render(
    <PiniaProvider plugins={[plugin]} initialStores={{ 'plugin-lazy': { count: 4 } }}>
      <span>pending</span>
    </PiniaProvider>
  )
  const instance = getActivePinia()
  expect(instance._s.size).toBe(0)
  expect(instance._p).toEqual([plugin])
  view.rerender(
    <PiniaProvider plugins={[changed]}>
      <Lazy />
    </PiniaProvider>
  )
  expect(events).toEqual(['plugin-lazy'])
  expect(plugin).toHaveBeenCalledOnce()
  expect(changed).not.toHaveBeenCalled()
  view.rerender(
    <PiniaProvider plugins={[plugin]}>
      <Lazy />
    </PiniaProvider>
  )
  expect(getActivePinia()).toBe(instance)
  expect(plugin).toHaveBeenCalledOnce()
  expect(instance._p).toEqual([plugin])
})
