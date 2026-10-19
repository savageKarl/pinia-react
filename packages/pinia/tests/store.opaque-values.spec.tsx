import { renderHook } from '@testing-library/react'
import { createPinia, defineStore, type MutationEvent } from '../src'

class Counter {
  count = 1
  read() {
    return this.count
  }
}

const opaqueValues = [
  {
    name: 'Date',
    create: () => new Date('2020-01-01T00:00:00.000Z'),
    read: (value: Date) => value.getUTCFullYear(),
    expected: 2020
  },
  { name: 'Map', create: () => new Map([['a', 1]]), read: (value: Map<string, number>) => value.get('a'), expected: 1 },
  { name: 'Set', create: () => new Set(['x']), read: (value: Set<string>) => value.has('x'), expected: true },
  { name: 'class', create: () => new Counter(), read: (value: Counter) => value.read(), expected: 1 }
] as const

const warning =
  '[pinia-react] Special state values are opaque. In-place mutation is not supported and will not emit patches, invalidate getters, or notify subscribers. Use plain data or replace the entire value through an Action or $patch().'

beforeEach(() => {
  createPinia()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

it.each(opaqueValues)('warns once per $name identity and preserves native reads', ({ create, read, expected }) => {
  const value = create()
  const { getStore } = defineStore('opaque-read', { state: () => ({ value }) })
  const store = getStore()
  expect(console.warn).not.toHaveBeenCalled()
  expect(store.value).toBe(value)
  expect(Reflect.apply(read, undefined, [store.value])).toBe(expected)
  expect(store.$state.value).toBe(value)
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(warning)
})

it.each(['store', '$state', 'getter', 'action', 'nested'] as const)(
  'warns on first special value exposure through %s',
  (route) => {
    const value = new Date('2020-01-01T00:00:00.000Z')
    const { getStore } = defineStore('opaque-route', {
      state: () => ({ value, nested: { value } }),
      getters: { exposed: (state) => state.value },
      actions: {
        expose() {
          return this.value
        }
      }
    })
    const store = getStore()
    expect(console.warn).not.toHaveBeenCalled()
    const exposed =
      route === 'store'
        ? store.value
        : route === '$state'
          ? store.$state.value
          : route === 'getter'
            ? store.exposed
            : route === 'action'
              ? store.expose()
              : store.nested.value
    expect(exposed).toBe(value)
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(warning)
  }
)

it('does not repeat the warning across renders or on inherited built-ins', () => {
  const { useStore } = defineStore('opaque-render', {
    state: () => ({ when: new Date(), items: [{ count: 1 }] })
  })
  const hook = renderHook(() => {
    const store = useStore()
    expect(store.items.toString()).toBe('[object Object]')
    expect([...store.items].map((item) => item.count)).toEqual([1])
    expect(store.$state.items.toString()).toBe('[object Object]')
    return store.when
  })
  hook.rerender()
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(warning)
})

it('warns on opaque Date mutation in a function patch without claiming it is reactive', () => {
  const events: MutationEvent[] = []
  createPinia().onMutation((event) => events.push(event))
  const { getStore } = defineStore('opaque-patch-date', {
    state: () => ({ when: new Date('2020-01-01T00:00:00.000Z') })
  })
  const store = getStore()
  store.$patch((draft) => {
    draft.when.setUTCFullYear(2021)
  })
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(warning)
  expect(store.when.getUTCFullYear()).toBe(2021)
  expect(events).toHaveLength(0)
})

it.each(['Map', 'Set'] as const)('retains Immer rejection of %s mutation inside function patches', (kind) => {
  const { getStore } = defineStore('opaque-patch-collection', {
    state: () => ({ map: new Map([['a', 1]]), set: new Set(['x']) })
  })
  const store = getStore()
  expect(() =>
    store.$patch((draft) => {
      if (kind === 'Map') draft.map.set('a', 2)
      else draft.set.add('y')
    })
  ).toThrow(/MapSet/)
  expect(store.map.get('a')).toBe(1)
  expect([...store.set]).toEqual(['x'])
})

it('warns for replacement identities and preserves restore origin and normal commit notifications', () => {
  const pinia = createPinia()
  let restore!: (when: Date) => void
  pinia.use(({ restoreState }) => {
    restore = (when) => restoreState({ when }, { origin: 'opaque-test' })
  })
  const events: MutationEvent[] = []
  pinia.onMutation((event) => events.push(event))
  const { getStore } = defineStore('opaque-restore', {
    state: () => ({ when: new Date('2020-01-01T00:00:00.000Z') }),
    getters: { year: (state) => state.when.getUTCFullYear() },
    actions: {
      replace(when: Date) {
        this.when = when
      }
    }
  })
  const store = getStore()
  expect(store.year).toBe(2020)
  store.replace(new Date('2021-01-01T00:00:00.000Z'))
  expect(store.year).toBe(2021)
  restore(new Date('2022-01-01T00:00:00.000Z'))
  expect(store.year).toBe(2022)
  expect(console.warn).toHaveBeenCalledTimes(3)
  expect(events).toHaveLength(2)
  expect(events[1].meta).toEqual({ type: 'restore', origin: 'opaque-test' })
  expect(events.map((event) => event.prevState.when.getUTCFullYear())).toEqual([2020, 2021])
  expect(pinia.state['opaque-restore']).toBe(events[1].state)
})

it('keeps symbol properties on opaque native values outside the plain-state boundary', () => {
  const marker = Symbol('native-metadata')
  const date = Object.assign(new Date('2020-01-01'), { [marker]: 1 })
  const { getStore } = defineStore('opaque-symbol-metadata', { state: () => ({ date }) })
  expect(getStore().date.getUTCFullYear()).toBe(2020)
  expect(getStore().date[marker]).toBe(1)
})
