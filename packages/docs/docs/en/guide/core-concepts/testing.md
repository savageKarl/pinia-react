# Testing real Stores

Use your existing test framework. Create a fresh Pinia for each test, pass it explicitly to accessors, and exercise real Actions and Getters:

~~~ts
import { createPinia, defineStore, disposePinia } from 'pinia-react'
import { expect, test } from 'vitest'

const { getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: state => state.count * 2 },
  actions: { add(amount: number) { this.count += amount } },
})

test('updates the derived count', () => {
  const pinia = createPinia()
  try {
    const counter = getCounterStore(pinia)
    counter.$patch({ count: 2 })
    counter.add(3)
    expect(counter.count).toBe(5)
    expect(counter.double).toBe(10)
    counter.$reset()
    expect(counter.count).toBe(0)
  } finally {
    disposePinia(pinia)
  }
})
~~~

Register test plugins before the first accessor call. Setup state through Actions or `$patch`; public state is read-only. `$reset` restores factory defaults, not a server snapshot or a test's patch.

## Components

Wrap the component with `<PiniaProvider pinia={pinia}>` using the same local instance as the test's explicit accessors. Do not also pass Provider `plugins` or `initialStores`; initialize the supplied instance before rendering. With React Testing Library, unmount the rendered tree before calling `disposePinia(pinia)`, and make sure teardown still runs when an assertion fails.

Use the framework's `act` or user-event helpers around updates and await the UI result. A render counter is not a performance assertion: Strict Mode, parents, and props can render independently of a Store notification.

## Async work and dependencies

Await Actions and assert the state after both success and rejection. Already committed writes survive a failed Action; test explicit recovery rather than assuming rollback. Keep instance arguments explicit after `await` when more than one instance exists.

For deterministic failures, inject the network or clock dependency into the business service and mock it with the test framework. Do not write directly to readonly Store State to force an outcome. Finish or cancel pending work before teardown, release manual subscriptions, and dispose only when the instance will no longer be used. Disposal does not cancel arbitrary Promises.

The existing [checkout example](../integrations/checkout-report) shows multi-Store business tests and equivalent UI inputs. [Instance lifetime](./outside-component-usage) and [plugin cleanup](../plugins/index) explain the boundaries.
