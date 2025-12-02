import {
  createPinia,
  defineStore,
  expectType,
  type Pinia,
  type PiniaPluginContext,
  type StoreGeneric,
  type TypeEqual
} from '.'

const pinia = createPinia()

pinia.use((context) => {
  expectType<PiniaPluginContext>(context)
  expectType<string>(context.id)
  expectType<StoreGeneric>(context.store)
  expectType<Pinia>(pinia)
})

declare module '../src' {
  export interface PiniaCustomProperties {
    test: number
  }
}

pinia.use(() => {
  return {
    test: 1
  }
})

const { getStore, useStore } = defineStore('test', {
  state: () => ({ a: 1 })
})

const store = getStore()
expectType<number>(store.test)

type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>

expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)
// biome-ignore lint/correctness/useHookAtTopLevel: <>
const hookReturn = useStore()
expectType<number>(hookReturn.test)
