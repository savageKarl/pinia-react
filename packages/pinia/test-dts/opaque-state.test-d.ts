import { defineStore, expectType } from '.'

const { getStore } = defineStore('opaque-types', {
  state: () => ({ when: new Date(), lookup: new Map<string, number>(), tags: new Set<string>() }),
  getters: { year: (state) => state.when.getUTCFullYear() },
  actions: {
    replace(when: Date) {
      this.when = when
    }
  }
})
const store = getStore()
expectType<number>(store.when.getUTCFullYear())
expectType<number | undefined>(store.lookup.get('a'))
expectType<boolean>(store.tags.has('x'))
expectType<number>(store.$state.when.getUTCFullYear())
expectType<number | undefined>(store.$state.lookup.get('a'))
expectType<boolean>(store.$state.tags.has('x'))
expectType<number>(store.year)
store.replace(new Date())
store.$patch({ when: new Date() })
