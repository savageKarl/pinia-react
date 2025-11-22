import { defineStore } from 'pinia-react'

export const useCounterStore = defineStore('counter', {
  state: () => {
    return { count: 0, name: 'Eduardo' }
  },
  actions: {
    increment() {
      this.count++
    }
  },
  getters: {
    doubleCount(): number {
      return this.count * 2
    },
    upperCaseName(state) {
      return state.name.toUpperCase()
    },
    doubleName() {
      return this.upperCaseName
    },
    composed() {
      // // debugger
      return this.upperCaseName + ': ok'
    },
    arrowUpper(): string {
      return this.name.toUpperCase()
    }
  }
})

export function App() {
  return <></>
}
