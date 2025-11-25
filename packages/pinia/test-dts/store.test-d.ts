import { defineStore, expectType, type TypeEqual } from '.'

// 1. 定义一个标准的、功能完整的 store 用于测试
const { getStore, useStore } = defineStore('main', {
  state: () => ({
    status: 'on' as 'on' | 'off',
    nested: { counter: 0 }
  }),
  getters: {
    upperStatus: (state) => {
      // Getter 的 state 参数类型应被正确推断
      expectType<'on' | 'off'>(state.status)
      return state.status.toUpperCase() as 'ON' | 'OFF'
    }
  },
  actions: {
    toggle() {
      // Action 的 `this` 上下文应包含 state
      this.status = this.status === 'on' ? 'off' : 'on'
    }
  }
})

// 2. 使用 `getStore()` 获取 store 实例并进行详细的类型测试
const store = getStore()

// 验证 state 属性的类型
expectType<'on' | 'off'>(store.status)
expectType<number>(store.nested.counter)

// 验证 getters 的类型
expectType<'ON' | 'OFF'>(store.upperStatus)

// 验证 actions 的类型
expectType<() => void>(store.toggle)

// 3. 验证负面测试用例（即类型系统应该报错的场景）
// @ts-expect-error - 访问一个不存在的属性应该导致类型错误
store.nonExistent

// @ts-expect-error - Getters 应该是只读的，不允许直接赋值
store.upperStatus = 'thing'

// 注意：根据您当前的类型定义 (`Store = S & ...`)，
// state 属性在 TypeScript 的静态类型层面是可写的。
// 运行时 Proxy 会发出警告，但这在编译时不会产生错误。
store.status = 'off'

// 4. 静态地验证 `useStore` hook 的返回类型
// 我们不能在 d.ts 测试文件中直接调用 hook，但可以验证它的返回类型
// 应该与 `getStore()` 的返回类型完全一致。
type StoreFromGetStore = ReturnType<typeof getStore>
type StoreFromUseStore = ReturnType<typeof useStore>
expectType<TypeEqual<StoreFromGetStore, StoreFromUseStore>>(true)

// 5. 测试一个只包含 state 的 store，验证类型推断是否正确
// 由于 `defineStore` 泛型已优化，不再需要提供空的 getters/actions
const { getStore: getMinimalStore } = defineStore('minimal', {
  state: () => ({
    dummy: true
  })
})
const minimalStore = getMinimalStore()

// minimalStore 的类型现在是精确的 `Store<"minimal", { dummy: boolean }, {}, {}>`
// 它不包含索引签名，因此访问不存在的属性会如期报错。
// @ts-expect-error - 此指令现在会按预期工作
minimalStore.nonExistent
