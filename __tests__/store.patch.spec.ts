import { defineStore, setActiveLiberate, createLiberate } from '../src'

describe('$store.patch', () => {
  beforeEach(() => {
    setActiveLiberate(createLiberate())
  })

  const useStore = defineStore('main', {
    state: () => ({
      a: true,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      },
      list: [] as number[]
    })
  })

  const useArrayStore = defineStore('main', {
    state: () => ({
      items: [{ id: 0 }],
      currentItem: { id: 1 }
    })
  })

  it('patches a property without touching the rest', () => {
    const store = useStore()
    store.$patch({ a: false })
    expect(store.$state).toEqual({
      a: false,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      },
      list: []
    })

    expect(store.a).toBe(false)
  })

  it('replaces whole arrays', () => {
    const store = useStore()
    store.$patch({ list: [1, 2] })
    expect(store.$state.list).toEqual([1, 2])
    expect(store.list).toEqual([1, 2])
  })

  it('can patch an item that has been copied to an array', () => {
    const store = useArrayStore()
    store.$state.currentItem = { id: 2 }
    store.items.push(store.currentItem)
    store.$state.currentItem = { id: 3 }

    expect(store.$state.items).toEqual([{ id: 0 }, { id: 2 }])
    expect(store.items).toEqual([{ id: 0 }, { id: 2 }])
  })

  it('replaces whole nested arrays', () => {
    const store = useStore()

    // @ts-expect-error: new state
    store.$patch({ nested: { list: [1, 2] } })
    expect(store.$state.nested).toEqual({
      foo: 'foo',
      a: { b: 'string' },
      list: [1, 2]
    })

    // @ts-expect-error: new state
    store.$patch({ nested: { list: [] } })
    expect(store.$state.nested).toEqual({
      foo: 'foo',
      a: { b: 'string' },
      list: []
    })
  })

  it('patches using a function', () => {
    const store = useStore()
    store.$patch((state) => {
      expect(state).toBe(store.$state)
      state.a = !state.a
      state?.list?.push(1)
    })
    expect(store.$state).toEqual({
      a: false,
      nested: {
        foo: 'foo',
        a: { b: 'string' }
      },
      list: [1]
    })
  })

  it('patches a nested property without touching the rest', () => {
    const store = useStore()
    store.$patch({ nested: { foo: 'bar' } })

    expect(store.$state).toEqual({
      a: true,
      nested: {
        foo: 'bar',
        a: { b: 'string' }
      },
      list: []
    })
    store.$patch({ nested: { a: { b: 'hello' } } })
    expect(store.$state).toEqual({
      a: true,
      nested: {
        foo: 'bar',
        a: { b: 'hello' }
      },
      list: []
    })
  })

  it('patches multiple properties at the same time', () => {
    const store = useStore()
    store.$patch({ a: false, nested: { foo: 'hello' } })

    // debugger

    expect(store.$state).toEqual({
      a: false,
      nested: {
        foo: 'hello',
        a: { b: 'string' }
      },
      list: []
    })
  })
})
