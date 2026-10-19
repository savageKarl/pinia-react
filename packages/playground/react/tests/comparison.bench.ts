// @vitest-environment node

import assert from 'node:assert/strict'
import { createPinia, defineStore, setActivePinia } from 'pinia-react'
import { type BenchTask, bench } from 'vitest'
import { create } from 'zustand'

const updates = 1_000
const subscribers = 100
const benchmarkOptions = { warmupIterations: 3, warmupTime: 100, time: 500, iterations: 10 }

// Vitest 3 passes setup to Tinybench's whole run, not each iteration. Install per-iteration hooks
// on the public Task options so both warmup and measured samples reset outside the timer.
function options(reset: () => void, verify: () => void) {
  return {
    ...benchmarkOptions,
    setup(task: BenchTask) {
      task.opts.beforeEach = reset
      task.opts.afterEach = verify
    }
  }
}

const initialState = () => ({ count: 0, other: 0 })

const { getStore: getPiniaStore } = defineStore('comparison-benchmark', {
  state: initialState,
  getters: {
    doubled: (state) => state.count * 2,
    chained(): number {
      return this.doubled + 1
    }
  },
  actions: {
    increment() {
      this.count++
    },
    noop() {}
  }
})

type ZustandState = ReturnType<typeof initialState> & {
  increment: () => void
  noop: () => void
  reset: () => void
}

function createPiniaStore() {
  setActivePinia(createPinia())
  return getPiniaStore()
}

function createZustandStore() {
  return create<ZustandState>((set) => ({
    ...initialState(),
    increment: () => set((state) => ({ count: state.count + 1 })),
    noop: () => {},
    reset: () => set(initialState())
  }))
}

const piniaStore = createPiniaStore()
const zustandStore = createZustandStore()

const piniaOneSubscriber = createPiniaStore()
const zustandOneSubscriber = createZustandStore()
piniaOneSubscriber.$subscribe(() => {})
zustandOneSubscriber.subscribe(() => {})

const piniaManySubscribers = createPiniaStore()
const zustandManySubscribers = createZustandStore()
for (let index = 0; index < subscribers; index++) {
  piniaManySubscribers.$subscribe(() => {})
  zustandManySubscribers.subscribe(() => {})
}

const piniaGetterStore = createPiniaStore()
const zustandGetterStore = createZustandStore()

bench(
  `Pinia-React: ${updates} action updates (no subscriber)`,
  () => {
    for (let index = 0; index < updates; index++) piniaStore.increment()
  },
  options(
    () => piniaStore.$reset(),
    () => assert.equal(piniaStore.count, updates)
  )
)

bench(
  `Zustand: ${updates} set updates (no subscriber)`,
  () => {
    for (let index = 0; index < updates; index++) zustandStore.getState().increment()
  },
  options(
    () => zustandStore.getState().reset(),
    () => assert.equal(zustandStore.getState().count, updates)
  )
)

bench(
  `Pinia-React: ${updates} action updates (one subscriber)`,
  () => {
    for (let index = 0; index < updates; index++) piniaOneSubscriber.increment()
  },
  options(
    () => piniaOneSubscriber.$reset(),
    () => assert.equal(piniaOneSubscriber.count, updates)
  )
)

bench(
  `Zustand: ${updates} set updates (one subscriber)`,
  () => {
    for (let index = 0; index < updates; index++) zustandOneSubscriber.getState().increment()
  },
  options(
    () => zustandOneSubscriber.getState().reset(),
    () => assert.equal(zustandOneSubscriber.getState().count, updates)
  )
)

bench(
  `Pinia-React: ${updates} action updates (${subscribers} subscribers)`,
  () => {
    for (let index = 0; index < updates; index++) piniaManySubscribers.increment()
  },
  options(
    () => piniaManySubscribers.$reset(),
    () => assert.equal(piniaManySubscribers.count, updates)
  )
)

bench(
  `Zustand: ${updates} set updates (${subscribers} subscribers)`,
  () => {
    for (let index = 0; index < updates; index++) zustandManySubscribers.getState().increment()
  },
  options(
    () => zustandManySubscribers.getState().reset(),
    () => assert.equal(zustandManySubscribers.getState().count, updates)
  )
)

bench(
  `Pinia-React: ${updates} $patch(fn) updates`,
  () => {
    for (let index = 0; index < updates; index++) {
      piniaStore.$patch((state) => {
        state.count++
      })
    }
  },
  options(
    () => piniaStore.$reset(),
    () => assert.equal(piniaStore.count, updates)
  )
)

bench(
  `Zustand: ${updates} functional set updates`,
  () => {
    for (let index = 0; index < updates; index++) {
      zustandStore.setState((state) => ({ count: state.count + 1 }))
    }
  },
  options(
    () => zustandStore.getState().reset(),
    () => assert.equal(zustandStore.getState().count, updates)
  )
)

bench(
  `Pinia-React: ${updates} $patch(object) updates`,
  () => {
    for (let index = 0; index < updates; index++) piniaStore.$patch({ count: piniaStore.count + 1 })
  },
  options(
    () => piniaStore.$reset(),
    () => assert.equal(piniaStore.count, updates)
  )
)

bench(
  `Zustand: ${updates} object set updates`,
  () => {
    for (let index = 0; index < updates; index++) {
      zustandStore.setState({ count: zustandStore.getState().count + 1 })
    }
  },
  options(
    () => zustandStore.getState().reset(),
    () => assert.equal(zustandStore.getState().count, updates)
  )
)

bench(
  `Pinia-React: ${updates} getter reads after invalidation`,
  () => {
    for (let index = 0; index < updates; index++) {
      piniaGetterStore.increment()
      piniaGetterStore.doubled
    }
  },
  options(
    () => piniaGetterStore.$reset(),
    () => assert.equal(piniaGetterStore.count, updates)
  )
)

bench(
  `Zustand: ${updates} derived reads after updates`,
  () => {
    for (let index = 0; index < updates; index++) {
      zustandGetterStore.getState().increment()
      zustandGetterStore.getState().count * 2
    }
  },
  options(
    () => zustandGetterStore.getState().reset(),
    () => assert.equal(zustandGetterStore.getState().count, updates)
  )
)

bench(
  `Pinia-React: ${updates} batched two-field updates`,
  () => {
    for (let index = 0; index < updates; index++) {
      piniaStore.$patch((state) => {
        state.count++
        state.other++
      })
    }
  },
  options(
    () => piniaStore.$reset(),
    () => assert.equal(piniaStore.count, updates)
  )
)

bench(
  `Zustand: ${updates} batched two-field updates`,
  () => {
    for (let index = 0; index < updates; index++) {
      zustandStore.setState((state) => ({ count: state.count + 1, other: state.other + 1 }))
    }
  },
  options(
    () => zustandStore.getState().reset(),
    () => assert.equal(zustandStore.getState().count, updates)
  )
)

bench(
  `Pinia-React: ${updates} no-op actions`,
  () => {
    for (let index = 0; index < updates; index++) piniaStore.noop()
  },
  options(
    () => piniaStore.$reset(),
    () => assert.equal(piniaStore.count, 0)
  )
)

bench(
  `Zustand: ${updates} no-op actions`,
  () => {
    for (let index = 0; index < updates; index++) zustandStore.getState().noop()
  },
  options(
    () => zustandStore.getState().reset(),
    () => assert.equal(zustandStore.getState().count, 0)
  )
)

bench(
  'Pinia-React: ' + updates + ' Getter chain invalidations',
  () => {
    for (let index = 0; index < updates; index++) {
      piniaGetterStore.increment()
      piniaGetterStore.chained
    }
  },
  options(
    () => piniaGetterStore.$reset(),
    () => assert.equal(piniaGetterStore.count, updates)
  )
)
bench(
  'Zustand: ' + updates + ' derived chain reads after updates',
  () => {
    for (let index = 0; index < updates; index++) {
      zustandGetterStore.getState().increment()
      zustandGetterStore.getState().count * 2 + 1
    }
  },
  options(
    () => zustandGetterStore.getState().reset(),
    () => assert.equal(zustandGetterStore.getState().count, updates)
  )
)

const crossPinia = createPinia()
const { getStore: getCrossSource } = defineStore('raw-cross-source', {
  state: initialState,
  actions: {
    increment() {
      this.count++
    }
  }
})
const { getStore: getCrossDerived } = defineStore('raw-cross-derived', {
  state: () => ({}),
  getters: { double: () => getCrossSource().count * 2 }
})
const crossZustand = createZustandStore()
const crossZustandDerived = create(() => ({ double: () => crossZustand.getState().count * 2 }))
bench(
  'Pinia-React: ' + updates + ' cross-Store getter invalidations',
  () => {
    for (let index = 0; index < updates; index++) {
      getCrossSource().increment()
      getCrossDerived().double
    }
  },
  options(
    () => {
      setActivePinia(crossPinia)
      getCrossSource().$reset()
      getCrossDerived().double
    },
    () => assert.equal(getCrossDerived().double, updates * 2)
  )
)
bench(
  'Zustand: ' + updates + ' cross-Store derived reads',
  () => {
    for (let index = 0; index < updates; index++) {
      crossZustand.getState().increment()
      crossZustandDerived.getState().double()
    }
  },
  options(
    () => crossZustand.getState().reset(),
    () => assert.equal(crossZustandDerived.getState().double(), updates * 2)
  )
)
