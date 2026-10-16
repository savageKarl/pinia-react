import { createPinia, defineStore, type PiniaPlugin, type PiniaPluginContext } from 'pinia-react'
import persistedState, {
  createPersistedState,
  type HydrateOptions,
  type Persist,
  type PersistenceOptions,
  type PluginOptions,
  type Serializer,
  type StatePath,
  type StorageLike
} from '../src'

function expectType<T>(_value: T) {}
const storage: StorageLike = { getItem: () => null, setItem: (_key, _value) => {} }
const serializer: Serializer = { serialize: JSON.stringify, deserialize: JSON.parse }
const options: PluginOptions = {
  storage,
  serializer,
  auto: true,
  key: (key) => `app:${key}`,
  beforeHydrate(context) {
    expectType<PiniaPluginContext>(context)
  }
}
expectType<PiniaPlugin>(persistedState)
createPinia().use(createPersistedState(options))
type State = { count: number; profile: { name: string }; items: string[] }
const path: StatePath<State> = 'profile.name'
const dynamic: string = 'dynamic.path'
const strategy: PersistenceOptions<State> = {
  pick: [path, dynamic],
  omit: [],
  onHydrateError(error, store) {
    expectType<Error>(error)
    expectType<number>(store.count)
  }
}
const persist: Persist<State> = [strategy, { key: (id) => id, storage, serializer }]
const { getCounterStore, useCounterStore } = defineStore('counter', {
  state: () => ({ count: 0, profile: { name: '' }, items: [''] }),
  persist,
  getters: { double: (state) => state.count * 2 },
  actions: {
    add(amount: number) {
      this.count += amount
    }
  }
})
const store = getCounterStore()
expectType<number>(store.double)
expectType<(amount: number) => void>(store.add)
expectType<ReturnType<typeof useCounterStore>>(store)
expectType<((options?: HydrateOptions) => void) | undefined>(store.$hydrate)
expectType<(() => void) | undefined>(store.$persist)
store.$hydrate?.({ runHooks: false })
store.$persist?.()
// @ts-expect-error Methods are optional because persistence may be disabled.
store.$persist()
// @ts-expect-error Storage reads must be synchronous strings or null.
const badStorage: StorageLike = { getItem: async () => '', setItem() {} }
// @ts-expect-error Serializer output must be a string, not a Promise.
const badSerializer: Serializer = { serialize: async () => '', deserialize: JSON.parse }
// @ts-expect-error Global key must be a function.
createPersistedState({ key: 'prefix' })
// @ts-expect-error pick/omit are per-store, not global.
createPersistedState({ pick: ['count'] })
// @ts-expect-error Invalid configuration.
defineStore('bad', { state: () => ({}), persist: 1 })
// @ts-expect-error Deserialization must also be synchronous and return an object.
const asyncDeserialize: Serializer = { serialize: JSON.stringify, deserialize: async () => ({ count: 1 }) }
// @ts-expect-error Storage keys must be strings.
const numericKeyStorage: StorageLike = { getItem: (_key: number) => null, setItem() {} }
void badStorage
void badSerializer
void asyncDeserialize
void numericKeyStorage
