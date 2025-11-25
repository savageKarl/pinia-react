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

// 通过模块扩展为 Pinia 自定义属性
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

// 1. 使用 `getStore()` 获取实例，验证插件添加的属性
const store = getStore()
expectType<number>(store.test)

// 2. 静态地验证 `useStore` 的返回类型也包含了插件属性
type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>

expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)
// biome-ignore lint/correctness/useHookAtTopLevel: <>
const hookReturn = useStore() // 仅用于类型推导，我们知道不能在顶层调用
expectType<number>(hookReturn.test)
