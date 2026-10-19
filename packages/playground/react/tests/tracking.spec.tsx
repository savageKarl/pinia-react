import { writeFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { createPinia, defineStore, getActivePinia, type StoreGeneric, setActivePinia } from 'pinia-react'
import { Profiler, version as reactVersion, StrictMode, useCallback } from 'react'
import { useStore as useZustandStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

type Workload =
  | 'independent'
  | 'unread'
  | 'selected'
  | 'nested'
  | 'array'
  | 'getter'
  | 'cross-store'
  | 'shared'
  | 'strict'
type Metrics = {
  renders: number
  notifications: number
  derivedEvaluations: number
  commits: number
  readers: number[]
}
type BenchState = Record<string, any> & {
  count: number
  unused: number
  nested: { value: number }
  items: { value: number }[]
  sourceValue: number
}
type BenchActions = {
  increment: () => void
  updateUnused: () => void
  updateNested: () => void
  append: () => void
  setField: (index: number) => void
  reset: () => void
}
type ZustandBenchStore = BenchState & BenchActions
type ZustandSourceStore = { sourceValue: number; reset: () => void }
type ZustandStore = StoreApi<ZustandBenchStore>
type ZustandSource = StoreApi<ZustandSourceStore>

const workloadNames: Workload[] = [
  'independent',
  'unread',
  'selected',
  'nested',
  'array',
  'getter',
  'cross-store',
  'shared',
  'strict'
]
const samples = 15
const probeKeys = Array.from({ length: 1_000 }, (_, index) => `probe-${index}`)
const { getStore: getPiniaSource } = defineStore('tracking-bench-source', {
  state: () => ({ sourceValue: 0 }),
  actions: {
    update() {
      this.sourceValue++
    },
    reset() {
      this.sourceValue = 0
    }
  }
})
const { useStore: usePiniaBenchmark, getStore: getPiniaBenchmark } = defineStore('tracking-bench', {
  state: (): BenchState => ({
    ...Object.fromEntries(Array.from({ length: 1_000 }, (_, index) => [`field${index}`, 0])),
    count: 0,
    unused: 0,
    nested: { value: 0 },
    items: [{ value: 0 }],
    sourceValue: 0
  }),
  getters: {
    first(state) {
      benchMetrics!.derivedEvaluations++
      return state.count + 1
    },
    second() {
      benchMetrics!.derivedEvaluations++
      return this.first + 1
    },
    third() {
      benchMetrics!.derivedEvaluations++
      return this.second + 1
    },
    fromOther() {
      benchMetrics!.derivedEvaluations++
      return getPiniaSource().sourceValue * 2
    }
  },
  actions: {
    increment() {
      this.count++
    },
    updateUnused() {
      this.unused++
    },
    updateNested() {
      this.nested.value++
    },
    append() {
      this.items.push({ value: this.items.length })
    },
    setField(index: number) {
      this[`field${index}`]++
    }
  }
})

function initialZustandState(): BenchState {
  return {
    ...Object.fromEntries(Array.from({ length: 1_000 }, (_, index) => [`field${index}`, 0])),
    count: 0,
    unused: 0,
    nested: { value: 0 },
    items: [{ value: 0 }],
    sourceValue: 0
  }
}

function selectPinia(store: StoreGeneric, workload: Workload, index: number) {
  switch (workload) {
    case 'independent':
    case 'strict':
      return store[`field${index}`]
    case 'unread':
    case 'selected':
    case 'shared':
      return store.count
    case 'nested':
      return store.nested.value
    case 'array':
      return store.items.map((item: { value: number }) => item.value).join(',')
    case 'getter':
      return store.third
    case 'cross-store':
      return store.fromOther
  }
}

function selectZustand(state: ZustandBenchStore, workload: Workload, index: number, metrics: Metrics) {
  switch (workload) {
    case 'independent':
    case 'strict':
      return state[`field${index}`]
    case 'unread':
    case 'selected':
    case 'shared':
      return state.count
    case 'nested':
      return state.nested.value
    case 'array':
      return state.items.map((item) => item.value).join(',')
    case 'getter':
      metrics.derivedEvaluations++
      return state.count + 3
    case 'cross-store':
      return state.sourceValue * 2
  }
}

let benchMetrics: Metrics | undefined

function PiniaProbe({ workload, index, metrics }: { workload: Workload; index: number; metrics: Metrics }) {
  const store = usePiniaBenchmark()
  metrics.renders++
  metrics.readers[index]++
  return <span>{String(selectPinia(store, workload, index))}</span>
}

function ZustandProbe({
  workload,
  index,
  metrics,
  useBenchStore
}: {
  workload: Workload
  index: number
  metrics: Metrics
  useBenchStore: ZustandStore
}) {
  const selector = useCallback(
    (state: ZustandBenchStore) => selectZustand(state, workload, index, metrics),
    [workload, index, metrics]
  )
  const value = useZustandStore(useBenchStore, selector)
  metrics.renders++
  metrics.readers[index]++
  return <span>{String(value)}</span>
}

function ZustandCrossStoreProbe({ metrics, useSourceStore }: { metrics: Metrics; useSourceStore: ZustandSource }) {
  const selector = useCallback(
    (state: ZustandSourceStore) => {
      metrics.derivedEvaluations++
      return state.sourceValue * 2
    },
    [metrics]
  )
  const value = useZustandStore(useSourceStore, selector)
  metrics.renders++
  metrics.readers[0]++
  return <span>{String(value)}</span>
}

function instrumentPinia(metrics: Metrics, internalListeners: Set<unknown>) {
  const pinia = getActivePinia()
  const restores: (() => void)[] = []
  for (const scope of pinia._scopes.values()) {
    for (const listener of [...scope.listeners]) {
      if (internalListeners.has(listener)) continue
      scope.listeners.delete(listener)
      const wrapped: typeof listener = (...args) => {
        metrics.notifications++
        listener(...args)
      }
      scope.listeners.add(wrapped)
      restores.push(() => {
        scope.listeners.delete(wrapped)
        scope.listeners.add(listener)
      })
    }
  }
  return () => restores.forEach((restore) => restore())
}

function instrumentZustand<T>(store: StoreApi<T>, metrics: Metrics) {
  const subscribe = store.subscribe
  store.subscribe = (listener) =>
    subscribe((...args) => {
      metrics.notifications++
      listener(...args)
    })
  return () => {
    store.subscribe = subscribe
  }
}

function updatePinia(workload: Workload, index: number) {
  const store = getPiniaBenchmark()
  if (workload === 'independent' || workload === 'strict') store.setField(index)
  else if (workload === 'unread') store.updateUnused()
  else if (workload === 'nested') store.updateNested()
  else if (workload === 'array') store.append()
  else if (workload === 'cross-store') getPiniaSource().update()
  else store.increment()
}

function updateZustand(workload: Workload, index: number, store: ZustandStore, sourceStore: ZustandSource) {
  const state = store.getState()
  if (workload === 'independent' || workload === 'strict') state.setField(index)
  else if (workload === 'unread') state.updateUnused()
  else if (workload === 'nested') state.updateNested()
  else if (workload === 'array') state.append()
  else if (workload === 'cross-store') sourceStore.setState((current) => ({ sourceValue: current.sourceValue + 1 }))
  else state.increment()
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

function resetStores(
  workload: Workload,
  implementation: 'Pinia-React' | 'Zustand',
  zustandStore?: ZustandStore,
  zustandSource?: ZustandSource
) {
  if (implementation === 'Pinia-React') {
    getPiniaBenchmark().$reset()
    if (workload === 'cross-store') getPiniaSource().reset()
  } else {
    zustandStore!.getState().reset()
    if (workload === 'cross-store') zustandSource!.getState().reset()
  }
}

function measure(workload: Workload, implementation: 'Pinia-React' | 'Zustand', count: number) {
  const metrics: Metrics = {
    renders: 0,
    notifications: 0,
    derivedEvaluations: 0,
    commits: 0,
    readers: Array(count).fill(0)
  }
  benchMetrics = metrics
  const pinia = implementation === 'Pinia-React' ? createPinia() : undefined
  if (pinia) setActivePinia(pinia)
  const zustandStore =
    implementation === 'Zustand'
      ? createStore<ZustandBenchStore>((set) => ({
          ...initialZustandState(),
          increment: () => set((state) => ({ count: state.count + 1 })),
          updateUnused: () => set((state) => ({ unused: state.unused + 1 })),
          updateNested: () => set((state) => ({ nested: { value: state.nested.value + 1 } })),
          append: () => set((state) => ({ items: [...state.items, { value: state.items.length }] })),
          setField: (index) => set((state) => ({ [`field${index}`]: state[`field${index}`] + 1 })),
          reset: () => set(initialZustandState())
        }))
      : undefined
  const zustandSource =
    implementation === 'Zustand'
      ? createStore<ZustandSourceStore>((set) => ({ sourceValue: 0, reset: () => set({ sourceValue: 0 }) }))
      : undefined

  // Capture library listeners before mounting; count actual React subscription callbacks, not a guessed offset.
  if (pinia) {
    getPiniaBenchmark()
    if (workload === 'cross-store') getPiniaBenchmark().fromOther
  }
  const internalListeners = new Set(pinia ? [...pinia._scopes.values()].flatMap((scope) => [...scope.listeners]) : [])

  function BenchmarkTree() {
    const probes =
      implementation === 'Zustand' && workload === 'cross-store' ? (
        <ZustandCrossStoreProbe metrics={metrics} useSourceStore={zustandSource!} />
      ) : (
        Array.from({ length: count }, (_, index) =>
          implementation === 'Pinia-React' ? (
            <PiniaProbe key={probeKeys[index]} workload={workload} index={index} metrics={metrics} />
          ) : (
            <ZustandProbe
              key={probeKeys[index]}
              workload={workload}
              index={index}
              metrics={metrics}
              useBenchStore={zustandStore!}
            />
          )
        )
      )
    return (
      <Profiler id='tracking-bench' onRender={() => metrics.commits++}>
        {probes}
      </Profiler>
    )
  }

  const restoreListeners =
    implementation === 'Pinia-React'
      ? undefined
      : instrumentZustand(workload === 'cross-store' ? zustandSource! : zustandStore!, metrics)
  const view = render(
    workload === 'strict' ? (
      <StrictMode>
        <BenchmarkTree />
      </StrictMode>
    ) : (
      <BenchmarkTree />
    )
  )
  const restorePiniaListeners =
    implementation === 'Pinia-React' ? instrumentPinia(metrics, internalListeners) : undefined
  metrics.renders = 0
  metrics.notifications = 0
  metrics.derivedEvaluations = 0
  metrics.commits = 0

  for (let index = 0; index < 3; index++) {
    act(() => {
      if (implementation === 'Pinia-React') updatePinia(workload, index % count)
      else updateZustand(workload, index % count, zustandStore!, zustandSource!)
    })
    act(() => resetStores(workload, implementation, zustandStore, zustandSource))
  }
  metrics.renders = 0
  metrics.notifications = 0
  metrics.derivedEvaluations = 0
  metrics.commits = 0

  const updateTimes: number[] = []
  const commitTimes: number[] = []
  let totalRenders = 0
  let totalNotifications = 0
  let totalDerivedEvaluations = 0
  let totalCommits = 0

  try {
    for (let sample = 0; sample < samples; sample++) {
      const before = { ...metrics }
      metrics.readers.fill(0)
      const totalStart = performance.now()
      act(() => {
        const updateStart = performance.now()
        if (implementation === 'Pinia-React') updatePinia(workload, sample % Math.max(1, count))
        else updateZustand(workload, sample % Math.max(1, count), zustandStore!, zustandSource!)
        updateTimes.push(performance.now() - updateStart)
      })
      commitTimes.push(performance.now() - totalStart)
      totalRenders += metrics.renders - before.renders
      totalNotifications += metrics.notifications - before.notifications
      totalDerivedEvaluations += metrics.derivedEvaluations - before.derivedEvaluations
      totalCommits += metrics.commits - before.commits
      const independent = workload === 'independent' || workload === 'strict'
      const changedReaders = workload === 'unread' ? 0 : independent ? 1 : count
      const renderMultiplier = workload === 'strict' ? 2 : 1
      expect(metrics.renders - before.renders).toBe(changedReaders * renderMultiplier)
      expect(metrics.commits - before.commits).toBe(changedReaders ? 1 : 0)
      // The Store fans out once to each subscriber, even if path/selector filtering prevents a render.
      expect(metrics.notifications - before.notifications).toBe(count)
      const spans = view.container.querySelectorAll('span')
      for (let reader = 0; reader < count; reader++) {
        const changed = workload !== 'unread' && (!independent || reader === sample % count)
        expect(metrics.readers[reader]).toBe(changed ? renderMultiplier : 0)
        const expected = !changed
          ? '0'
          : workload === 'getter'
            ? '4'
            : workload === 'cross-store'
              ? '2'
              : workload === 'array'
                ? '0,1'
                : '1'
        expect(spans[reader].textContent).toBe(expected)
      }
      if (implementation === 'Pinia-React') {
        const store = getPiniaBenchmark()
        expect(workload === 'unread' ? store.unused : selectPinia(store, workload, sample % count)).toBe(
          workload === 'getter' ? 4 : workload === 'cross-store' ? 2 : workload === 'array' ? '0,1' : 1
        )
        expect(metrics.derivedEvaluations - before.derivedEvaluations).toBe(
          workload === 'getter' ? 3 : workload === 'cross-store' ? 1 : 0
        )
      }
      act(() => resetStores(workload, implementation, zustandStore, zustandSource))
      expect(Array.from(view.container.querySelectorAll('span')).map((node) => node.textContent)).toEqual(
        Array(count).fill(workload === 'getter' ? '3' : '0')
      )
      metrics.renders = 0
      metrics.notifications = 0
      metrics.derivedEvaluations = 0
      metrics.commits = 0
    }
  } finally {
    restorePiniaListeners?.()
    view.unmount()
    restoreListeners?.()
    cleanup()
    benchMetrics = undefined
  }

  return {
    workload: `${workload}${workload === 'independent' ? `-${count}` : ''}`,
    implementation,
    reactSubscriptions: count,
    storeUpdateMsMedian: median(updateTimes).toFixed(3),
    storeUpdateMsRange: [Math.min(...updateTimes), Math.max(...updateTimes)].map((n) => n.toFixed(3)).join('–'),
    reactFlushMsMedian: median(commitTimes.map((total, index) => total - updateTimes[index])).toFixed(3),
    updateAndReactFlushMsMedian: median(commitTimes).toFixed(3),
    renderCallsPerUpdate: (totalRenders / samples).toFixed(2),
    commitsPerUpdate: (totalCommits / samples).toFixed(2),
    subscriptionCallbacksPerUpdate: (totalNotifications / samples).toFixed(2),
    derivedEvaluationsPerUpdate: (totalDerivedEvaluations / samples).toFixed(2)
  }
}

// This mounts and checks 20 workload rows; the timeout is a safety bound, not a performance budget.
it('measures equivalent mounted React tracking workloads', () => {
  const results = []
  for (const workload of workloadNames) {
    const counts =
      workload === 'independent'
        ? [100, 1_000]
        : workload === 'strict' || workload === 'unread' || workload === 'shared'
          ? [100]
          : [1]
    for (const count of counts) {
      for (const implementation of ['Pinia-React', 'Zustand'] as const) {
        results.push(measure(workload, implementation, count))
      }
    }
  }
  console.log(`React ${reactVersion}, ${samples} measured updates per row (jsdom)`)
  console.table(results)
  if (process.env.PINIA_BENCH_REPORT)
    writeFileSync(process.env.PINIA_BENCH_REPORT, JSON.stringify({ react: reactVersion, samples, results }, null, 2))
  expect(results).toHaveLength(20)
  expect(results.every((result) => Number.isFinite(Number(result.updateAndReactFlushMsMedian)))).toBe(true)
}, 30_000)
