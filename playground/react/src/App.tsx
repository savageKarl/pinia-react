import { defineStore } from '../../../src'

export const useCounterStore = defineStore('counter', {
  state: () => {
    return { count: 0 }
  },
  actions: {
    increment() {
      this.count++
    }
  },
  getters: {
    doubleCount(state) {
      return state.count * 2
    }
  }
})

const increment = () => {
  const store = useCounterStore.$getStore()
  store.increment.call(null)
}

export function App() {
  const store = useCounterStore()
  return (
    <>
      <h1>React</h1>
      <h2>count: {store.count}</h2>
      <h3>doubleCount: {store.doubleCount}</h3>
      <button onClick={() => increment()}>increate</button>
    </>
  )
}
