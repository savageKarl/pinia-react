# State

State 是 Store 的核心，它是一个响应式的对象，包含了应用中所有需要共享的原始数据。

**概念解释：**

* **响应式:** Pinia 的 State 基于 Vue 3 的 `reactive` API 构建。当 State 中的数据发生变化时，所有依赖于该数据的组件都会自动更新视图。
* **扁平化设计:** Pinia 推荐使用扁平化的 State 结构，而不是多层嵌套。例如，将用户信息和购物车信息分开存储在不同的 Store 中，以提高可读性和模块化。

在大多数情况下，state 都是你的 store 的核心。人们通常会先定义能代表他们 APP 的 state。在 Pinia 中，state 被定义为一个返回初始状态的函数。

```tsx
import { defineStore } from 'pinia-react'

const useStore = defineStore('storeId', {
  // 为了完整类型推理，推荐使用箭头函数
  state: () => {
    return {
      // 所有这些属性都将自动推断出它们的类型
      count: 0,
      name: 'Eduardo',
      isAdmin: true,
      items: [],
      hasChanged: true,
    }
  },
})
```


## TypeScript

你并不需要做太多努力就能使你的 state 兼容 TS。确保启用了 strict，或者至少启用了 noImplicitThis，Pinia 将自动推断您的状态类型！ 但是，在某些情况下，您应该帮助它进行一些转换：

```tsx
const useStore = defineStore('storeId', {
  state: () => {
    return {
      // 用于初始化空列表
      userList: [] as UserInfo[],
      // 用于尚未加载的数据
      user: null as UserInfo | null,
    }
  },
})

interface UserInfo {
  name: string
  age: number
}
```

如果你愿意，你可以用一个接口定义 state，并添加 state() 的返回值的类型。

```tsx
interface State {
  userList: UserInfo[]
  user: UserInfo | null
}

interface UserInfo {
  name: string
  age: number
}

const useStore = defineStore('storeId', {
  state: (): State => {
    return {
      userList: [],
      user: null,
    }
  },
})
```


## 访问 state
默认情况下，你可以通过 store 实例访问 state，直接对其进行读写。

```tsx
const store = useStore()

store.count++
```

## 重置 state

你可以通过调用 store 的 $reset() 方法将 state 重置为初始值。

```tsx
const store = useStore()

store.$reset()
```

## 变更 state

除了用 store.count++ 直接改变 store，你还可以调用 $patch 方法。它允许你用一个 state 的补丁对象在同一时间更改多个属性：

```tsx
store.$patch({
  count: store.count + 1,
  age: 120,
  name: 'DIO',
})
```

不过，用这种语法的话，有些变更真的很难实现或者很耗时：任何集合的修改（例如，向数组中添加、移除一个元素或是做 splice 操作）都需要你创建一个新的集合。因此，$patch 方法也接受一个函数来组合这种难以用补丁对象实现的变更。

```tsx
store.$patch((state) => {
  state.items.push({ name: 'shoes', quantity: 1 })
  state.hasChanged = true
})
```


## 替换 state

```tsx
// 这实际上并没有替换`$state`
store.$state = { count: 24 }
// 在它内部调用 `$patch()`：
store.$patch({ count: 24 })
```

## 订阅 state

你可以通过 store 的 $subscribe() 方法侦听 state 及其变化。

```tsx
cartStore.$subscribe((mutation, state) => {
  // import { MutationType } from 'pinia-react'
  mutation.type // 'direct' | 'patch object' | 'patch function'
  // 和 cartStore.$id 一样
  mutation.storeId // 'cart'
  // 只有 mutation.type === 'patch object'的情况下才可用
  mutation.payload // 传递给 cartStore.$patch() 的补丁对象。

  // 每当状态发生变化时，将整个 state 持久化到本地存储。
  localStorage.setItem('cart', JSON.stringify(state))
})
```

## 取消订阅 

默认情况下，state subscription 会被绑定到添加它们的组件上。这意味着，当该组件被卸载时，它们将被自动删除。如果你想在组件卸载后依旧保留它们，请将 { detached: true } 作为第二个参数，以将 state subscription 从当前组件中分离：

```tsx
const someStore = useSomeStore()
// 此订阅器即便在组件卸载之后仍会被保留
someStore.$subscribe(callback, { detached: true })
```