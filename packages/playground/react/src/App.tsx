import { createPinia, defineStore } from 'pinia-react'
import React from 'react'

export const { useStore, getStore } = defineStore('main', {
  state: () => ({
    count: 0,
    user: { name: 'Developer', level: 1 }
  }),

  getters: {
    double(state) {
      return state.count * 2
    },
    doublePlusOne(): number {
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
    },
    replaceState() {
      this.$patch(() => {
        return {
          count: 999,
          user: { name: 'Admin', level: 99 }
        }
      })
    }
  }
})

const DemoComponent = () => {
  const store = useStore()
  const secret = (store as any).secretKey

  React.useEffect(() => {
    const unsub = store.$subscribe((state, prev) => {
      console.log(`[UI Subscribe] State changed. Prev count: ${prev.count}, New count: ${state.count}`)
    })
    return unsub
  }, [store])

  return (
    <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h3>Pinia React Plugin & $state Demo (Fixed)</h3>
      <div style={{ marginBottom: 10, padding: 10, background: '#f5f5f5' }}>
        <strong>Plugin Injected Prop:</strong> {secret}
      </div>

      <div>Count: {store.count}</div>
      <div>Double: {store.double}</div>
      <div>Double+1: {store.doublePlusOne}</div>
      <div>Message: {store.message}</div>

      <div style={{ marginTop: 15, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => store.increment()}>Increment</button>
        <button onClick={() => store.changeName('Expert')}>Change Name</button>
        <button onClick={() => store.randomReset()} style={{ color: 'orange' }}>
          Reset
        </button>
        <button onClick={() => store.replaceState()} style={{ color: 'red' }}>
          Replace State via $patch
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <details>
          <summary>Current Full State ($state)</summary>
          <pre style={{ fontSize: 12 }}>{JSON.stringify(store.$state, null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}

export function App() {
  return <DemoComponent />
}
