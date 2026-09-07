import { createPinia, defineStore, expectType, type MutationEvent } from '.'

const pinia = createPinia()
pinia.onMutation((event) => {
  expectType<MutationEvent>(event)
  expectType<string>(event.storeId)
  expectType<'action' | 'patch' | 'reset' | 'restore'>(event.meta.type)
})

pinia.use((context) => {
  context.restoreState({ count: 1 }, { origin: 'plugin' })
  // @ts-expect-error restore type is intentionally limited to system operations
  context.restoreState({ count: 1 }, { type: 'action' })
})

defineStore('counter', {
  state: () => ({ count: 0 })
})
