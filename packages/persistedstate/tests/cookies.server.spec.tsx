// @vitest-environment node

import { createPinia, defineStore, getActivePinia, PiniaProvider } from 'pinia-react'
import { renderToString } from 'react-dom/server'
import { createCookiePersistedState, readCookieSnapshot } from '../src/next'

it('restores separate request cookies on the server without browser access or response writes', () => {
  const active = createPinia()
  const { useStore } = defineStore('preferences', {
    state: () => ({ theme: 'light' }),
    getters: { label: (state) => state.theme.toUpperCase() },
    persist: true
  })
  function View() {
    const store = useStore()
    return (
      <span>
        {store.theme}:{store.label}
      </span>
    )
  }
  const renderRequest = (theme: string) => {
    const reader = { get: vi.fn(() => ({ value: JSON.stringify({ theme }) })), set: vi.fn() }
    const cookies = readCookieSnapshot(reader, ['preferences'])
    const html = renderToString(
      <PiniaProvider plugins={[createCookiePersistedState({ cookies })]}>
        <View />
      </PiniaProvider>
    )
    expect(reader.set).not.toHaveBeenCalled()
    return html.replaceAll('<!-- -->', '')
  }
  expect(renderRequest('dark')).toContain('dark:DARK')
  expect(renderRequest('blue')).toContain('blue:BLUE')
  expect(getActivePinia()).toBe(active)
  expect(active.state).toEqual({})
})

it('server-side saves are inert, missing cookies preserve defaults and manual hydrate rereads the supplied request snapshot', () => {
  const cookies = { server: '{"count":3}' }
  const pinia = createPinia().use(createCookiePersistedState({ cookies }))
  const store = defineStore('server', { state: () => ({ count: 0 }), persist: true }).getStore()
  store.$patch({ count: 7 })
  store.$persist?.()
  expect(store.count).toBe(7)
  store.$hydrate?.()
  expect(store.count).toBe(3)
  expect(cookies.server).toBe('{"count":3}')
  expect(pinia.state.server.count).toBe(3)
})
