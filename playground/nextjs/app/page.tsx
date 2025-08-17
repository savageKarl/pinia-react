'use client'
import { defineStore } from '../../../src'
import './style.css'
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
  store.increment()
}

export default function Page() {
  const store = useCounterStore()
  return (
    <div id='app'>
      <h1>NextJs</h1>
      <h2>count: {store.count}</h2>
      <h3>doubleCount: {store.doubleCount}</h3>
      <button onClick={() => increment()}>increate</button>
    </div>
  )
}
