/** biome-ignore-all lint/suspicious/noDocumentCookie: Exercise synchronous browser Cookie persistence and browser/server divergence. */
import { act, fireEvent, render } from '@testing-library/react'
import { defineStore, PiniaProvider } from 'pinia-react'
import { StrictMode, Suspense, useEffect } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { type CookieSnapshot, createCookiePersistedState } from '../src/next'

const { useStore, getStore } = defineStore('cookieHydration', {
  state: () => ({ count: 0, profile: { name: 'default' } }),
  getters: { label: (state) => `${state.count}:${state.profile.name}` },
  actions: {
    increment() {
      this.count++
    }
  },
  persist: { pick: ['count', 'profile.name'] }
})
function View() {
  const store = useStore()
  return <button onClick={() => store.increment()}>{store.label}</button>
}
function Providers({ cookies, children }: { cookies: CookieSnapshot; children: React.ReactNode }) {
  return (
    <PiniaProvider
      plugins={[createCookiePersistedState({ cookies })]}
      initialStores={{ cookieHydration: { count: 10, profile: { name: 'server' } } }}
    >
      {children}
    </PiniaProvider>
  )
}

beforeEach(() => {
  document.cookie = 'cookieHydration=; Max-Age=0; Path=/'
})
afterEach(() => vi.restoreAllMocks())

it('hydrates matching cookie state despite a browser change, without initial writes, in StrictMode', async () => {
  const cookies = { cookieHydration: '{"count":4,"profile":{"name":"cookie"}}' }
  const tree = (
    <StrictMode>
      <Providers cookies={cookies}>
        <View />
      </Providers>
    </StrictMode>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  expect(container).toHaveTextContent('4:cookie')
  document.body.append(container)
  document.cookie = `cookieHydration=${encodeURIComponent('{"count":99} ')}; Path=/`
  const write = vi.spyOn(Document.prototype, 'cookie', 'set')
  const recoverable = vi.fn()
  let root!: ReturnType<typeof hydrateRoot>
  try {
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: recoverable })
    })
    expect(recoverable).not.toHaveBeenCalled()
    expect(container).toHaveTextContent('4:cookie')
    expect(write).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('button')!)
    expect(container).toHaveTextContent('5:cookie')
    expect(write).toHaveBeenCalledOnce()
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})

it('keeps the request snapshot through rerenders and lazy stores; remounting accepts a new snapshot', () => {
  const cookies = { cookieHydration: '{"count":4}' }
  const view = render(
    <Providers cookies={cookies}>
      <span>not yet</span>
    </Providers>
  )
  document.cookie = `cookieHydration=${encodeURIComponent('{"count":99}')}; Path=/`
  view.rerender(
    <Providers cookies={{ cookieHydration: '{"count":88}' }}>
      <View />
    </Providers>
  )
  expect(view.getByRole('button')).toHaveTextContent('4:server')
  fireEvent.click(view.getByRole('button'))
  view.rerender(
    <Providers cookies={{ cookieHydration: '{"count":77}' }}>
      <View />
    </Providers>
  )
  expect(view.getByRole('button')).toHaveTextContent('5:server')
  view.unmount()
  const remount = render(
    <Providers cookies={{ cookieHydration: '{"count":8}' }}>
      <View />
    </Providers>
  )
  expect(remount.getByRole('button')).toHaveTextContent('8:server')
})

it('does not roll back a user commit while a Suspense boundary is waiting to hydrate', async () => {
  const cookies = { cookieHydration: '{"count":3}' }
  let blocked = false
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  function Early() {
    const store = useStore()
    useEffect(() => {
      store.increment()
    }, [store.increment])
    return <span>{store.label}</span>
  }
  function Delayed() {
    if (blocked) throw ready
    return <View />
  }
  const tree = (
    <Providers cookies={cookies}>
      <Early />
      <Suspense fallback={<i>waiting</i>}>
        <Delayed />
      </Suspense>
    </Providers>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  const recoverable = vi.fn()
  const events = vi.fn()
  let root!: ReturnType<typeof hydrateRoot>
  blocked = true
  try {
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: recoverable })
    })
    const stop = getStore().$subscribe(events)
    await act(async () => {
      blocked = false
      release()
    })
    expect(recoverable).not.toHaveBeenCalled()
    expect(container.querySelector('button')).toHaveTextContent('4:server')
    expect(events).not.toHaveBeenCalled() // Rendering the old snapshot never commits it backwards.
    fireEvent.click(container.querySelector('button')!)
    expect(container.querySelector('button')).toHaveTextContent('5:server')
    expect(events).toHaveBeenCalledOnce()
    stop()
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})
