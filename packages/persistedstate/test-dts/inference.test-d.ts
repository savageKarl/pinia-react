import { defineStore, type PiniaPluginContext } from 'pinia-react'
import { createPersistedState, type PersistenceOptions } from '../src'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function exact<T extends true>(_proof: T) {}

const { getTypedStore, useTypedStore } = defineStore('typed', {
  state: () => ({ count: 1, profile: { name: '' }, note: null as string | null }),
  getters: { double: (state) => state.count * 2 },
  actions: {
    increment(amount: number) {
      this.count += amount
      return this.count
    },
    async load() {
      await Promise.resolve()
      return this.count
    }
  },
  persist: {
    pick: ['profile.name', 'count'],
    beforeHydrate(context) {
      const name = context.store.profile.name
      const double = context.store.double
      const increment = context.store.increment
      const load = context.store.load
      const state = context.options.state()
      exact<Equal<typeof name, string>>(true)
      exact<Equal<typeof double, number>>(true)
      exact<Equal<typeof increment, (amount: number) => number>>(true)
      exact<Equal<typeof load, () => Promise<number>>>(true)
      exact<Equal<typeof state.profile.name, string>>(true)
      context.restoreState({ count: 1, profile: { name: 'Ada' }, note: null })
      // @ts-expect-error Unknown state properties are not accepted through any.
      context.store.nonexistent
      // @ts-expect-error Current action parameter types are preserved.
      context.store.increment('wrong')
      // @ts-expect-error Restoration requires a complete state of the current shape.
      context.restoreState({ count: 1 })
      // @ts-expect-error Public state stays read-only.
      context.store.$state.count = 2
    },
    afterHydrate({ store }) {
      const name = store.profile.name
      exact<Equal<typeof name, string>>(true)
      const result = store.increment(1)
      exact<Equal<typeof result, number>>(true)
    },
    onHydrateError(_error, store) {
      exact<Equal<typeof _error, Error>>(true)
      const count = store.count
      const double = store.double
      const action = store.increment
      exact<Equal<typeof count, number>>(true)
      exact<Equal<typeof double, number>>(true)
      exact<Equal<typeof action, (amount: number) => number>>(true)
    },
    onPersistError(_error, store) {
      const result = store.load()
      exact<Equal<typeof result, Promise<number>>>(true)
      // @ts-expect-error Unknown fields are rejected on error callback stores.
      store.missing
    }
  }
})
const typed = getTypedStore()
exact<Equal<typeof typed, ReturnType<typeof useTypedStore>>>(true)
exact<Equal<typeof typed.double, number>>(true)
exact<Equal<typeof typed.increment, (amount: number) => number>>(true)

const definition = defineStore('arrayTyped', {
  state: () => ({ count: 1, profile: { name: '' } }),
  getters: { label: (state) => state.profile.name },
  actions: {
    rename(name: string) {
      this.profile.name = name
    }
  },
  persist: [
    {
      pick: ['profile.name'],
      beforeHydrate({ store }) {
        const label = store.label
        exact<Equal<typeof label, string>>(true)
        exact<Equal<typeof store.rename, (name: string) => void>>(true)
      }
    },
    {
      omit: ['count'],
      onPersistError(_error, store) {
        const name = store.profile.name
        exact<Equal<typeof name, string>>(true)
        exact<Equal<typeof store.rename, (name: string) => void>>(true)
      }
    }
  ]
})
const arrayTyped = definition.getArrayTypedStore()
exact<Equal<typeof arrayTyped.label, string>>(true)

// Standalone state-only configuration is useful without inventing getters/actions.
const stateOnly: PersistenceOptions<{ count: number }> = {
  beforeHydrate({ store, options }) {
    exact<Equal<typeof store.count, number>>(true)
    const initial = options.state()
    exact<Equal<typeof initial.count, number>>(true)
    // @ts-expect-error Only state and core/plugin API are known without a store type.
    store.increment()
  }
}
void stateOnly

createPersistedState({
  beforeHydrate(_context) {
    // A global plugin serves multiple stores; it cannot infer one particular store.
    exact<Equal<typeof _context, PiniaPluginContext>>(true)
  }
})

const stateAndStore: PersistenceOptions<
  ReturnType<typeof getTypedStore>['$state'],
  ReturnType<typeof getTypedStore>
> = {
  afterHydrate({ store }) {
    exact<Equal<typeof store.double, number>>(true)
    exact<Equal<typeof store.increment, (amount: number) => number>>(true)
  },
  onPersistError(_error, _store) {
    exact<Equal<typeof _store.load, () => Promise<number>>>(true)
  }
}
void stateAndStore

const optionalState = defineStore('optionalTyped', {
  state: (): {
    profile?: { name: string }
    selected: { kind: 'first'; first: string } | { kind: 'second'; second: number } | null
    dictionary: Record<string, { value: number }>
    items: readonly { name: string }[]
  } => ({ selected: null, dictionary: {}, items: [] }),
  persist: {
    pick: ['profile.name', 'selected.first', 'selected.second', 'items'],
    beforeHydrate({ store }) {
      const name = store.profile?.name
      const selected = store.selected
      const value = store.dictionary.dynamic.value
      exact<Equal<typeof name, string | undefined>>(true)
      exact<Equal<typeof selected, { kind: 'first'; first: string } | { kind: 'second'; second: number } | null>>(true)
      exact<Equal<typeof value, number>>(true)
      // @ts-expect-error Public array snapshots remain read-only.
      store.$state.items.push({ name: 'wrong' })
    }
  }
})
void optionalState
interface RecursiveNode {
  label: string
  next?: RecursiveNode
}
const recursive = defineStore('recursiveTyped', {
  state: (): { node: RecursiveNode } => ({ node: { label: 'root' } }),
  persist: {
    pick: ['node.next.next.label'],
    afterHydrate({ store }) {
      const label = store.node.next?.label
      exact<Equal<typeof label, string | undefined>>(true)
    }
  }
})
void recursive
