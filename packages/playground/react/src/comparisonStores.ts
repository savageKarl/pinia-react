import { defineStore } from 'pinia-react'
import { create } from 'zustand'

export type Item = {
  id: string
  name: string
  price: number
}

export type Status = 'idle' | 'loading' | 'ready'

type ComparisonState = {
  count: number
  name: string
  items: Item[]
  status: Status
  message: string
}

type ComparisonActions = {
  increment: () => void
  rename: (name: string) => void
  addItem: () => void
  removeItem: () => void
  load: () => Promise<void>
}

const initialState = (): ComparisonState => ({
  count: 0,
  name: 'Ada',
  items: [{ id: 'notebook', name: 'Notebook', price: 12 }],
  status: 'idle',
  message: 'No request yet'
})

export const { useStore: useComparisonStore, getStore: getComparisonStore } = defineStore('comparison-lab', {
  state: initialState,
  getters: {
    itemCount: (state) => state.items.length,
    total: (state) => state.items.reduce((sum, item) => sum + item.price, 0)
  },
  actions: {
    increment() {
      this.count++
    },
    rename(name: string) {
      this.name = name
    },
    addItem() {
      this.items.push({ id: `item-${this.items.length + 1}`, name: 'Pen', price: 3 })
    },
    removeItem() {
      if (this.items.length > 1) this.items.pop()
    },
    async load() {
      this.status = 'loading'
      this.message = 'Loading profile...'
      await new Promise((resolve) => setTimeout(resolve, 350))
      this.status = 'ready'
      this.message = `Loaded preferences for ${this.name}`
    }
  }
})

export type ZustandComparisonStore = ComparisonState & ComparisonActions

export const useZustandComparison = create<ZustandComparisonStore>((set, get) => ({
  ...initialState(),
  increment: () => set((state) => ({ count: state.count + 1 })),
  rename: (name) => set({ name }),
  addItem: () =>
    set((state) => ({
      items: [...state.items, { id: `item-${state.items.length + 1}`, name: 'Pen', price: 3 }]
    })),
  removeItem: () => set((state) => (state.items.length > 1 ? { items: state.items.slice(0, -1) } : state)),
  load: async () => {
    set({ status: 'loading', message: 'Loading profile...' })
    await new Promise((resolve) => setTimeout(resolve, 350))
    set({ status: 'ready', message: `Loaded preferences for ${get().name}` })
  }
}))

export function resetComparisonZustand() {
  useZustandComparison.setState(initialState())
}
