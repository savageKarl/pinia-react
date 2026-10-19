import { createPinia, defineStore, disposePinia } from 'pinia-react'
import { createPersistedState } from '../src'

it('applies setup patches after hydrate and persists resets without rehydrating or reinstalling resources', () => {
  let saved = '{"count":3}'
  const storage = {
    getItem: vi.fn(() => saved),
    setItem: vi.fn((_key: string, value: string) => {
      saved = value
    })
  }
  const installed = vi.fn()
  const stopped = vi.fn()
  const definition = defineStore('reset-persisted', {
    state: () => ({ count: 0 }),
    persist: true,
    actions: {
      add() {
        this.count++
      }
    }
  })
  const pinia = createPinia()
    .use(createPersistedState({ storage }))
    .use(({ onDispose }) => {
      installed()
      onDispose?.(stopped)
    })
  try {
    const store = definition.getStore(pinia)
    store.$patch({ count: 4 })
    expect(store.count).toBe(4)
    expect(saved).toBe('{"count":4}')
    expect(storage.getItem).toHaveBeenCalledOnce()
    expect(storage.setItem).toHaveBeenCalledOnce()
    store.$reset()
    store.$reset()
    expect(saved).toBe('{"count":0}')
    expect(storage.getItem).toHaveBeenCalledOnce()
    expect(storage.setItem).toHaveBeenCalledTimes(3)
    expect(installed).toHaveBeenCalledOnce()
    expect(stopped).not.toHaveBeenCalled()
  } finally {
    disposePinia(pinia)
  }
  expect(stopped).toHaveBeenCalledOnce()
  expect(saved).toBe('{"count":0}')
})
