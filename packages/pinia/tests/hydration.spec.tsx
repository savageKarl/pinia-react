import { act, fireEvent } from '@testing-library/react'
import { Suspense, useEffect } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { defineStore, PiniaProvider } from '../src'

it('hydrates a delayed Suspense reader with its initial state and getters before catching up to a newer commit', async () => {
  const { useStore, getStore } = defineStore('delayedSnapshot', {
    state: () => ({ count: 1, profile: { name: 'initial' } }),
    getters: {
      double: (state) => state.count * 2,
      label(): string {
        return `${this.double}:${this.profile.name}`
      }
    },
    actions: {
      increment() {
        this.count++
      }
    }
  })
  const { useStore: useDerived } = defineStore('delayedDerived', {
    state: () => ({}),
    getters: { fromOther: () => getStore().label }
  })
  let blocked = false
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  function Early() {
    const store = useStore()
    useEffect(() => {
      store.$patch({ count: 5, profile: { name: 'new' } })
    }, [store.$patch])
    return (
      <button onClick={() => store.increment()}>
        {store.count}:{store.label}
      </button>
    )
  }
  function Delayed() {
    if (blocked) throw ready
    const store = useStore()
    const derived = useDerived()
    return (
      <p>
        {store.count}|{store.$state.profile.name}|{store.double}|{store.label}|{derived.fromOther}
      </p>
    )
  }
  const tree = (
    <PiniaProvider>
      <Early />
      <Suspense fallback={<i>waiting</i>}>
        <Delayed />
      </Suspense>
    </PiniaProvider>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  expect(container).toHaveTextContent('1|initial|2|2:initial|2:initial')
  document.body.append(container)
  const recoverable = vi.fn()
  blocked = true
  let root!: ReturnType<typeof hydrateRoot>
  try {
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: recoverable })
    })
    expect(container.querySelector('button')).toHaveTextContent('5')
    await act(async () => {
      blocked = false
      release()
    })
    expect(container).toHaveTextContent('5|new|10|10:new|10:new')
    expect(recoverable).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('button')!)
    expect(container).toHaveTextContent('6|new|12|12:new|12:new')
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})

it('allows a lazy cross-store plugin to access its own initializing Store during a server snapshot read', () => {
  const { getStore: getLate } = defineStore('initializingLate', { state: () => ({ count: 3 }) })
  const { useStore: useDerived } = defineStore('initializingDerived', {
    state: () => ({}),
    getters: { label: () => getLate().count }
  })
  const plugin = vi.fn(({ id }) => {
    if (id === 'initializingLate') expect(getLate().count).toBe(3)
  })
  function View() {
    return <span>{useDerived().label}</span>
  }
  expect(
    renderToString(
      <PiniaProvider plugins={[plugin]}>
        <View />
      </PiniaProvider>
    )
  ).toContain('3')
  expect(plugin).toHaveBeenCalledTimes(2)
})
