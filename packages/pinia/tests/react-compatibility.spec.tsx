import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { createPinia, defineStore } from '../src'

beforeEach(() => createPinia())

it('keeps snapshot identity stable on no-op writes and replaces dynamic dependencies only after commit', () => {
  const { useStore, getStore } = defineStore('compat-snapshot', {
    state: () => ({ left: 0, right: 10, selected: 'left' as 'left' | 'right' }),
    actions: {
      set(key: 'left' | 'right', value: number) {
        this[key] = value
      },
      select() {
        this.selected = 'right'
      }
    }
  })
  const renders = vi.fn()
  const notifications = vi.fn()
  const store = getStore()
  const unsubscribe = store.$subscribe(notifications)
  function Reader() {
    const current = useStore()
    renders()
    return <button onClick={() => current.select()}>{current[current.selected]}</button>
  }
  const view = render(
    <StrictMode>
      <Reader />
    </StrictMode>
  )
  const initial = store.$state
  renders.mockClear()
  act(() => store.set('left', 0))
  expect(store.$state).toBe(initial)
  expect(renders).not.toHaveBeenCalled()
  expect(notifications).not.toHaveBeenCalled()
  act(() => store.set('right', 11))
  expect(store.$state).not.toBe(initial)
  expect(renders).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('11')
  expect(renders).toHaveBeenCalledTimes(2)
  renders.mockClear()
  act(() => store.set('left', 1))
  expect(renders).not.toHaveBeenCalled()
  act(() => store.set('right', 12))
  expect(screen.getByRole('button')).toHaveTextContent('12')
  expect(renders).toHaveBeenCalledTimes(2)
  view.unmount()
  unsubscribe()
})

it('keeps 200 consecutive updates, cached Getter chains, notifications and final DOM consistent', () => {
  const evaluations = vi.fn()
  const { useStore, getStore } = defineStore('compat-burst', {
    state: () => ({ count: 0 }),
    getters: {
      double(state) {
        evaluations()
        return state.count * 2
      },
      label(): string {
        return String(this.double)
      }
    },
    actions: {
      increment() {
        this.count++
      }
    }
  })
  const notifications = vi.fn()
  const store = getStore()
  const stop = store.$subscribe(notifications)
  function Reader() {
    return <output>{useStore().label}</output>
  }
  render(<Reader />)
  expect(evaluations).toHaveBeenCalledOnce()
  // Bounded, individually flushed updates: this is a correctness check, not a long pressure benchmark.
  for (let index = 1; index <= 200; index++) {
    act(() => store.increment())
    expect(screen.getByRole('status')).toHaveTextContent(String(index * 2))
    expect(store.count).toBe(index)
    expect(store.double).toBe(index * 2)
    expect(store.label).toBe(String(index * 2))
    expect(evaluations).toHaveBeenCalledTimes(index + 1)
  }
  expect(notifications).toHaveBeenCalledTimes(200)
  act(() => {
    for (let index = 0; index < 200; index++) store.increment()
  })
  expect(screen.getByRole('status')).toHaveTextContent('800')
  expect(store.count).toBe(400)
  expect(notifications).toHaveBeenCalledTimes(400)
  stop()
})
