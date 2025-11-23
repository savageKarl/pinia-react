import { defineStore } from 'pinia-react'
import React from 'react'

export const { useStore, getStore } = defineStore('main', {
  state: () => ({
    count: 0,
    user: { name: 'Developer', level: 1 }
  }),

  getters: {
    double(state) {
      console.debug('double')
      return state.count * 2
    },

    doublePlusOne(state): number {
      return this.double + 1
    },

    message(state) {
      return `User ${state.user.name} has count ${state.count}`
    }
  },

  actions: {
    increment() {
      this.$patch((state) => {
        state.count++
      })
    },
    changeName(name: string) {
      this.$patch((state) => {
        state.user.name = name
      })
    },
    randomReset() {
      this.$reset()
    }
  }
})

// --- 组件演示 ---

const DemoComponent = () => {
  const store = useStore()
  const g = store.double

  React.useEffect(() => {
    // [验证]: 这里的 state 和 prev 也没有 unused 警告，因为我们使用了它们
    const unsub = store.$subscribe((state, prev) => {
      console.log(`[Subscribe] Count: ${prev.count} -> ${state.count}`)
    })
    return unsub
  }, [store])

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h3>Fixed Store Demo</h3>
      <div>Count: {store.count}</div>
      {/* [验证]: store.double 返回 number，ReactNode 兼容，不再报错 */}
      <div>Double: {store.double}</div>

      <div>Double+1: {store.doublePlusOne}</div>
      <div>Message: {store.message}</div>

      <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        <button onClick={() => store.increment()}>Increment</button>
        <button onClick={() => store.changeName('Expert')}>Change Name</button>
        <button onClick={() => store.randomReset()} style={{ color: 'red' }}>
          Reset
        </button>
      </div>
    </div>
  )
}

export function App() {
  return <DemoComponent />
}
