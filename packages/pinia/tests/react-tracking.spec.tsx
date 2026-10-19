import { act, fireEvent, render, screen } from '@testing-library/react'
import { Suspense, startTransition, useState } from 'react'
import { createPinia, defineStore, setActivePinia } from '../src'

beforeEach(() => {
  setActivePinia(createPinia())
})

it('tracks array structure read by length and iteration', () => {
  const { useStore, getStore } = defineStore('tracking-array', {
    state: () => ({ items: [{ label: 'first' }] }),
    actions: {
      add() {
        this.items.push({ label: 'second' })
      },
      renameFirst(label: string) {
        this.items[0].label = label
      }
    }
  })
  const renderCount = vi.fn()
  function List() {
    const store = useStore()
    renderCount()
    return <p>{store.items.map((item) => item.label).join(', ')}</p>
  }

  render(<List />)
  expect(screen.getByText('first')).toBeInTheDocument()
  renderCount.mockClear()

  act(() => getStore().add())
  expect(screen.getByText('first, second')).toBeInTheDocument()
  expect(renderCount).toHaveBeenCalledOnce()

  act(() => getStore().renameFirst('updated'))
  expect(screen.getByText('updated, second')).toBeInTheDocument()
  expect(renderCount).toHaveBeenCalledTimes(2)
})

it('tracks dynamic and dotted keys without notifying readers of other keys', () => {
  const { useStore, getStore } = defineStore('tracking-keys', {
    state: () => ({ selected: 'left', fields: { left: 'L', right: 'R' }, 'user.name': 'Ada' }),
    actions: {
      update(key: 'left' | 'right', value: string) {
        this.fields[key] = value
      },
      rename(name: string) {
        this['user.name'] = name
      }
    }
  })
  const renderCount = vi.fn()
  function View() {
    const store = useStore()
    renderCount()
    return (
      <p>
        {store.fields[store.selected]}:{store['user.name']}
      </p>
    )
  }

  render(<View />)
  expect(screen.getByText('L:Ada')).toBeInTheDocument()
  renderCount.mockClear()

  act(() => getStore().update('right', 'changed'))
  expect(renderCount).not.toHaveBeenCalled()

  act(() => getStore().update('left', 'changed'))
  expect(screen.getByText('changed:Ada')).toBeInTheDocument()
  expect(renderCount).toHaveBeenCalledOnce()

  act(() => getStore().rename('Lin'))
  expect(screen.getByText('changed:Lin')).toBeInTheDocument()
  expect(renderCount).toHaveBeenCalledTimes(2)
})

it('treats a $state read as a dependency on every state mutation', () => {
  const { useStore, getStore } = defineStore('tracking-state', {
    state: () => ({ count: 0, unused: 0 }),
    actions: {
      updateUnused() {
        this.unused++
      }
    }
  })
  const renderCount = vi.fn()
  function StateView() {
    const store = useStore()
    renderCount()
    return <p>{store.$state.count}</p>
  }

  render(<StateView />)
  renderCount.mockClear()
  act(() => getStore().updateUnused())

  expect(renderCount).toHaveBeenCalledOnce()
})

it('rejects symbol writes without notifying React and ignores inherited built-in reads', () => {
  const marker = Symbol('marker')
  const { useStore, getStore } = defineStore('tracking-symbol-rejection', {
    state: () => ({ value: { label: 'before', other: 0 } }),
    actions: {
      rejectMarker() {
        Reflect.set(this.value, marker, 'after')
      },
      updateLabel() {
        this.value.label = 'after'
      },
      updateOther() {
        this.value.other++
      }
    }
  })
  const renderCount = vi.fn()
  function View() {
    const store = useStore()
    renderCount()
    return (
      <p>
        {store.value.label}:{store.value.toString()}
      </p>
    )
  }
  render(<View />)
  expect(screen.getByText('before:[object Object]')).toBeInTheDocument()
  renderCount.mockClear()
  act(() => {
    expect(() => getStore().rejectMarker()).toThrow(/symbol.*state/i)
  })
  expect(renderCount).not.toHaveBeenCalled()
  act(() => getStore().updateOther())
  expect(renderCount).not.toHaveBeenCalled()
  act(() => getStore().updateLabel())
  expect(screen.getByText('after:[object Object]')).toBeInTheDocument()
  expect(renderCount).toHaveBeenCalledOnce()
})

it('updates a component when a cross-Store Getter dependency changes', () => {
  const { getStore: getSource } = defineStore('tracking-cross-source', {
    state: () => ({ count: 0 }),
    actions: {
      increment() {
        this.count++
      }
    }
  })
  const { useStore } = defineStore('tracking-cross-derived', {
    state: () => ({}),
    getters: { doubled: () => getSource().count * 2 }
  })
  const renderCount = vi.fn()
  function View() {
    const store = useStore()
    renderCount()
    return <p>{store.doubled}</p>
  }

  render(<View />)
  expect(screen.getByText('0')).toBeInTheDocument()
  act(() => getSource().increment())

  expect(screen.getByText('2')).toBeInTheDocument()
  expect(renderCount).toHaveBeenCalledTimes(2)
})

it('keeps committed tracking paths when a concurrent render suspends', async () => {
  const { useStore, getStore } = defineStore('tracking-concurrent', {
    state: () => ({ count: 0, other: 1 }),
    actions: {
      increment() {
        this.count++
      },
      updateOther() {
        this.other++
      }
    }
  })
  const renderCount = vi.fn()
  let release!: () => void
  const delayed = new Promise<void>((resolve) => {
    release = resolve
  })
  let blocked = true
  function Reader() {
    const store = useStore()
    const [readOther, setReadOther] = useState(false)
    renderCount()
    if (readOther) {
      const other = store.other
      if (blocked) throw delayed
      return (
        <p>
          {store.count}:{other}
        </p>
      )
    }
    return (
      <>
        <button onClick={() => startTransition(() => setReadOther(true))}>Read other</button>
        <p>{store.count}:not-read</p>
      </>
    )
  }
  const view = render(
    <Suspense fallback={<i>waiting</i>}>
      <Reader />
    </Suspense>
  )

  try {
    fireEvent.click(screen.getByRole('button', { name: 'Read other' }))
    expect(screen.getByText('0:not-read')).toBeInTheDocument()
    expect(screen.queryByText('waiting')).not.toBeInTheDocument()
    const committedRenderCount = renderCount.mock.calls.length
    act(() => getStore().updateOther())
    expect(renderCount).toHaveBeenCalledTimes(committedRenderCount)
    act(() => getStore().increment())
    expect(screen.getByText('1:not-read')).toBeInTheDocument()
    expect(screen.queryByText('waiting')).not.toBeInTheDocument()
    expect(renderCount.mock.calls.length).toBeGreaterThan(committedRenderCount)
  } finally {
    await act(async () => {
      blocked = false
      release()
    })
    expect(screen.getByText('1:2')).toBeInTheDocument()
    act(() => getStore().updateOther())
    expect(screen.getByText('1:3')).toBeInTheDocument()
    view.unmount()
  }
})
