'use client'
import { defineStore } from '../../../src'

export const useCounterStore = defineStore('counter', {
  state: () => {
    return { count: 0 }
  },
  actions: {
    increment() {
      this.count++
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
      <h2>{store.count}</h2>
      <button onClick={() => increment()}>increate</button>
    </div>
  )
}
