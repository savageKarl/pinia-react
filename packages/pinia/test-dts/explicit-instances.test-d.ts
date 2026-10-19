import { createPinia, defineStore, expectType, type Pinia, type TypeEqual } from '.'

const pinia = createPinia()
const { getOtherStore } = defineStore('other', {
  state: () => ({ count: 0 }),
  actions: {
    increment() {
      this.count++
    }
  }
})
const { getStore, getExplicitStore, useStore, useExplicitStore } = defineStore('explicit', {
  state: () => ({ count: 0 }),
  getters: {
    total(): number {
      return getOtherStore(pinia).count + this.count
    }
  },
  actions: {
    async increment() {
      getOtherStore(pinia).increment()
      await Promise.resolve()
      getOtherStore(pinia).increment()
      this.count++
      return this.count
    }
  }
})
expectType<TypeEqual<typeof getStore, typeof getExplicitStore>>(true)
expectType<TypeEqual<Parameters<typeof getStore>, [pinia?: Pinia]>>(true)
expectType<TypeEqual<ReturnType<typeof getStore>, ReturnType<typeof useStore>>>(true)
expectType<TypeEqual<typeof useStore, typeof useExplicitStore>>(true)
expectType<number>(getExplicitStore(pinia).total)
expectType<Promise<number>>(getStore(pinia).increment())
getStore()
getStore(undefined)
getExplicitStore()
// @ts-expect-error only a Pinia instance is accepted
getStore({})
// @ts-expect-error named accessors have the same parameter type
getExplicitStore('instance')
// @ts-expect-error Hooks remain parameterless
expectType<Parameters<typeof useStore>>([pinia])
