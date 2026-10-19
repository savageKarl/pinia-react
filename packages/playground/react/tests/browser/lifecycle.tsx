import { createPinia, defineStore, disposePinia, PiniaProvider } from 'pinia-react'
import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

export async function checkLifecycleFixture() {
  let installed = 0
  let stopped = 0
  const definition = defineStore('browser-lifecycle', {
    state: () => ({ count: 0 }),
    actions: {
      add(n: number) {
        this.count += n
        return this.count
      },
      outer(n: number) {
        return this.add(n)
      },
      async later(gate: Promise<void>) {
        await gate
        this.count++
      }
    }
  })
  const check = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message)
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    const pinia = createPinia().use(({ onDispose }) => {
      installed++
      onDispose?.(() => {
        stopped++
      })
    })
    const store = definition.getStore(pinia)
    store.$patch({ count: 4 })
    const other = createPinia()
    const mutations: string[] = []
    pinia.onMutation((event) => {
      if (event.meta.action) mutations.push(event.meta.action)
    })
    const node = document.createElement('div')
    document.body.append(node)
    const root = createRoot(node)
    function Counter() {
      const value = definition.useStore()
      return <button onClick={() => value.outer(1)}>{value.count}</button>
    }
    try {
      flushSync(() =>
        root.render(
          <StrictMode>
            <PiniaProvider pinia={pinia}>
              <Counter />
            </PiniaProvider>
          </StrictMode>
        )
      )
      flushSync(() => node.querySelector('button')!.click())
      check(node.textContent === '5', 'Supplied Context instance must remain reactive')
      check(definition.getStore(other).count === 0, 'Sibling instance must remain isolated')
      check(mutations.includes('add'), 'Nested real Action must emit its Mutation')
      check(store.outer(2) === 7 && store.count === 7, 'Nested Action must run its real implementation')
      flushSync(() => store.$reset())
      check(node.textContent === '0', 'Reset must notify mounted components')
      flushSync(() => node.querySelector('button')!.click())
      check(node.textContent === '1', 'Reset must preserve real Action')
      let release!: () => void
      const pending = store.later(
        new Promise<void>((done) => {
          release = done
        })
      )
      flushSync(() => root.unmount())
      disposePinia(pinia)
      release()
      let rejected = false
      try {
        await pending
      } catch (error) {
        rejected = error instanceof Error && /disposed/.test(error.message)
      }
      check(rejected, 'Disposed async Action must reject old commits')
      check(pinia._s.size === 0 && pinia._m.size === 0, 'Cleanup must release runtime registries')
    } finally {
      try {
        root.unmount()
      } finally {
        disposePinia(pinia)
        disposePinia(other)
        node.remove()
      }
    }
  }
  check(installed === 3 && stopped === 3, 'Strict Mode must not reinstall or auto-dispose plugin resources')
  return { cycles: 3, installed, stopped }
}
