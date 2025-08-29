## 基础使用

### 初始化：

```tsx
import { createPinia } from 'pinia-react';
const pinia = createPinia();
```

### 创建和使用Store

```tsx
import { defineStore } from 'pinia-react'
import { useEffect } from 'react'

// 定义store（与Pinia完全一致的API）
const useCounterStore = defineStore('counter', {
  // 定义初始状态
  state: () => ({
    count: 0,
    name: 'Counter'
  }),
  
  // 定义getter方法（类似计算属性）
  getters: {
    doubleCount() {
      return this.count * 2
    }
  },
  
  // 定义actions方法
  actions: {
    increment() {
      this.count++
    },
    
    async fetchSomething() {
      // 支持异步操作
      const result = await api.get('/data')
      this.count = result.count
    }
  }
})

// 在组件中使用
function Counter() {
  // 获取store实例
  const store = useCounterStore()
  
  useEffect(() => {
    // 可以调用action方法
    store.fetchSomething()
  }, [])
  
  return (
    <div>
      <h1>{store.name}: {store.count}</h1>
      <p>Double count: {store.doubleCount}</p>
      <button onClick={() => store.increment()}>Increment</button>
    </div>
  )
}
```

### 多个Store之间的交互

```tsx
import { defineStore } from 'pinia-react'

// 用户Store
const useUserStore = defineStore('user', {
  state: () => ({
    name: 'Anonymous',
    isAdmin: false
  }),
  actions: {
    login(name, admin = false) {
      this.name = name
      this.isAdmin = admin
    },
    logout() {
      this.name = 'Anonymous'
      this.isAdmin = false
    }
  }
})

// Cart Store，依赖于用户Store
const useCartStore = defineStore('cart', {
  state: () => ({
    items: []
  }),
  getters: {
    isEmpty() {
      return this.items.length === 0
    },
    // 可以使用其他store
    isCheckoutAllowed() {
      const userStore = useUserStore.$getStore()
      return this.items.length > 0 && userStore.name !== 'Anonymous'
    }
  },
  actions: {
    addItem(item) {
      this.items.push(item)
    },
    checkout() {
      const userStore = useUserStore.$getStore()
      if (userStore.name === 'Anonymous') {
        throw new Error('Login required')
      }
      // 处理结账逻辑...
      this.items = []
    }
  }
})
```

### 插件系统

pinia-react 支持通过插件扩展功能。

```ts
import { createpinia } from 'pinia-react'

// 创建pinia实例
const pinia = createpinia()

// 使用插件
pinia.use(myPlugin)


// 插件示例
function myPlugin({ store, options }) {
  // 为store添加自定义属性或方法
  return {
    customProperty: 'value',
    customMethod() {
      // 自定义逻辑
    }
  }
}
```
