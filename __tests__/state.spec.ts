import { defineStore } from '../src'

describe('state', () => {
  const useStore = defineStore('main', {
    state: () => ({
      name: 'Eduardo',
      counter: 0,
      nested: { n: 0 }
    })
  })

  beforeEach(() => {
    const store = useStore()
    store.$reset()
  })

  it('can directly access state at the store level', () => {
    const store = useStore()
    expect(store.name).toBe('Eduardo')
    store.name = 'Ed'
    expect(store.name).toBe('Ed')
  })

  it('can be set with patch', () => {
    const store = useStore()

    store.$patch({ name: 'a' })

    expect(store.name).toBe('a')
    expect(store.$state.name).toBe('a')
  })

  it('can be set on store', () => {
    const store = useStore()

    store.name = 'a'

    expect(store.name).toBe('a')
    expect(store.$state.name).toBe('a')
  })

  it('can be set on store.$state', () => {
    const store = useStore()

    store.$state.name = 'a'

    expect(store.name).toBe('a')
    expect(store.$state.name).toBe('a')
  })

  it('can be nested set with patch', () => {
    const store = useStore()

    store.$patch({ nested: { n: 3 } })

    expect(store.nested.n).toBe(3)
    expect(store.$state.nested.n).toBe(3)
  })

  it('can be nested set on store', () => {
    const store = useStore()

    store.nested.n = 3

    expect(store.nested.n).toBe(3)
    expect(store.$state.nested.n).toBe(3)
  })

  it('can be nested set on store.$state', () => {
    const store = useStore()

    store.$state.nested.n = 3

    expect(store.nested.n).toBe(3)
    expect(store.$state.nested.n).toBe(3)
  })
})
