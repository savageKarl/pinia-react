import { createPinia, expectType, type Pinia, type PiniaPluginContext, type StoreGeneric } from '.'

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
