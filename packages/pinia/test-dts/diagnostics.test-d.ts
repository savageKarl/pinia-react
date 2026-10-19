import { createPinia, defineStore, expectType, onStoreDebug, type StoreDebugEvent, type StoreDebugListener } from '.'

const { useStore, useDebugStore, getStore } = defineStore('debug', {
  state: () => ({ count: 0 }),
  getters: { double: (state) => state.count * 2 },
  actions: {
    add() {
      this.count++
    }
  }
})
export function HookTypes() {
  expectType<ReturnType<typeof getStore>>(useStore())
  expectType<ReturnType<typeof getStore>>(useStore('Counter'))
  expectType<ReturnType<typeof getStore>>(useDebugStore('Counter'))
  expectType<() => ReturnType<typeof getStore>>(useStore)
  // @ts-expect-error Labels are strings, not a selector or options object.
  useStore({ debug: true })
  // @ts-expect-error Selectors are not supported.
  useDebugStore((state: { count: number }) => state.count)
}
const listener: StoreDebugListener = (event) => {
  expectType<StoreDebugEvent>(event)
  if (event.type === 'dependencies') {
    expectType<readonly string[]>(event.getters)
    // @ts-expect-error Diagnostic paths are read-only.
    event.statePaths[0].push('changed')
  } else {
    expectType<number>(event.mutation.id)
    // @ts-expect-error Sensitive arguments are not part of the debug contract.
    event.mutation.meta.args
    // @ts-expect-error Diagnostic patches omit values.
    event.mutation.patches[0].value
    // @ts-expect-error Diagnostic metadata is read-only.
    event.mutation.meta.type = 'reset'
    if (event.type === 'notify' && event.reason.kind === 'state-path') {
      expectType<readonly (string | number)[]>(event.reason.path)
    }
  }
}
expectType<() => void>(onStoreDebug(createPinia(), listener))
