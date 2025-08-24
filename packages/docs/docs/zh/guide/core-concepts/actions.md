# Action

Actions 是用于修改 State 的方法。它们是 Store 中执行业务逻辑的地方，可以包含异步操作（如 API 调用）、复杂的计算和多个 State 变量的修改。

**概念解释：**
* **唯一的修改入口:** 推荐将所有状态修改操作都封装在 Actions 中。这使得数据修改的来源清晰可见，方便调试和追踪。
* **同步与异步:** Actions 支持同步和异步操作。你可以直接在 Actions 中使用 `async/await` 来处理异步任务，如从后端获取数据。
* **模块化:** Actions 将复杂的业务逻辑从组件中抽离，使得组件变得更简洁、更易于维护。

它们可以通过 defineStore() 中的 actions 属性来定义，并且它们也是定义业务逻辑的完美选择。


```tsx
export const useCounterStore = defineStore('main', {
  state: () => ({
    count: 0,
  }),
  actions: {
    increment() {
      this.count++
    },
    randomizeCounter() {
      this.count = Math.round(100 * Math.random())
    },
  },
})
```

类似 getter，action 也可通过 this 访问整个 store 实例，并支持完整的类型标注(以及自动补全✨)。不同的是，action 可以是异步的，你可以在它们里面 await 调用任何 API，以及其他 action！下面是一个使用 Mande 的例子。请注意，你使用什么库并不重要，只要你得到的是一个Promise。你甚至可以 (在浏览器中) 使用原生 fetch 函数：

```tsx
import { mande } from 'mande'

const api = mande('/api/users')

export const useUsers = defineStore('users', {
  state: () => ({
    userData: null,
    // ...
  }),

  actions: {
    async registerUser(login, password) {
      try {
        this.userData = await api.post({ login, password })
        showTooltip(`Welcome back ${this.userData.name}!`)
      } catch (error) {
        showTooltip(error)
        // 让表单组件显示错误
        return error
      }
    },
  },
})
```

你也完全可以自由地设置任何你想要的参数以及返回任何结果。当调用 action 时，一切类型也都是可以被自动推断出来的。

Action 可以像函数或者通常意义上的方法一样被调用：

```tsx
export function App() {

  const store = useCounterStore()
  // 将 action 作为 store 的方法进行调用
  store.randomizeCounter()

  return (
    <button onClick={store.randomizeCounter}></button>
  )
}
```

## 访问其他 store 的 action

想要使用另一个 store 的话，那你直接在 action 中调用就好了：

```tsx
import { useAuthStore } from './auth-store'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    preferences: null,
    // ...
  }),
  actions: {
    async fetchUserPreferences() {
      const auth = useAuthStore.$getStore()
      if (auth.isAuthenticated) {
        this.preferences = await fetchPreferences()
      } else {
        throw new Error('User must be authenticated')
      }
    },
  },
})
```

## 订阅 action

你可以通过 store.$onAction() 来监听 action 和它们的结果。传递给它的回调函数会在 action 本身之前执行。after 表示在 promise 解决之后，允许你在 action 解决后执行一个回调函数。同样地，onError 允许你在 action 抛出错误或 reject 时执行一个回调函数。

这里有一个例子，在运行 action 之前以及 action resolve/reject 之后打印日志记录。

```tsx
const unsubscribe = someStore.$onAction(
  ({
    name, // action 名称
    store, // store 实例，类似 `someStore`
    args, // 传递给 action 的参数数组
    after, // 在 action 返回或解决后的钩子
    onError, // action 抛出或拒绝的钩子
  }) => {
    // 为这个特定的 action 调用提供一个共享变量
    const startTime = Date.now()
    // 这将在执行 "store "的 action 之前触发。
    console.log(`Start "${name}" with params [${args.join(', ')}].`)

    // 这将在 action 成功并完全运行后触发。
    // 它等待着任何返回的 promise
    after((result) => {
      console.log(
        `Finished "${name}" after ${
          Date.now() - startTime
        }ms.\nResult: ${result}.`
      )
    })

    // 如果 action 抛出或返回一个拒绝的 promise，这将触发
    onError((error) => {
      console.warn(
        `Failed "${name}" after ${Date.now() - startTime}ms.\nError: ${error}.`
      )
    })
  }
)

// 手动删除监听器
unsubscribe()
```

默认情况下，action 订阅器会被绑定到添加它们的组件上。这意味着，当该组件被卸载时，它们将被自动删除。如果你想在组件卸载后依旧保留它们，请将 true 作为第二个参数传递给 action 订阅器，以便将其从当前组件中分离：

```tsx
import { useEffect } from 'react'

useEffect(() => {
  const someStore = useSomeStore()
  // 此订阅器即便在组件卸载之后仍会被保留
  someStore.$onAction(callback, true)
})
```