// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { defineStore, setActiveLiberate, createLiberate } from '../dist'

beforeEach(() => {
  setActiveLiberate(createLiberate())
})

describe('single component', () => {
  const useStore = defineStore('aStore', {
    state: () => ({ count: 0 })
  })

  const fn = vi.fn()
  function A() {
    const store = useStore()
    fn()
    return (
      <>
        <h1>count: {store.count}</h1>
        <button onClick={() => store.count++}>add</button>
      </>
    )
  }

  test('should render correct number of times', async () => {
    render(<A></A>)
    const countText = screen.getByText(/0/)
    expect(countText).toBeInTheDocument()
    expect(fn).toHaveBeenCalledTimes(1)

    const button = screen.queryByRole('button')
    await userEvent.click(button!)
    expect(screen.getByText(/1/)).toBeInTheDocument()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('mutiple component', () => {
  const useA = defineStore('aStore', {
    state: () => ({ count: 0 })
  })

  const useB = defineStore('bStore', {
    state: () => ({ count: 0 })
  })

  const bfn = vi.fn()
  function B() {
    const store = useB()
    bfn()
    return (
      <>
        <h1 role='headingB'>count: {store.count}</h1>
        <button
          role='btnB'
          onClick={() => store.count++}
        >
          add
        </button>
      </>
    )
  }

  const afn = vi.fn()
  function A() {
    const store = useA()
    afn()
    return (
      <>
        <h1 role='headingA'>count: {store.count}</h1>
        <div>
          <button
            role='btnA'
            onClick={() => store.count++}
          >
            add
          </button>
        </div>
        <B></B>
      </>
    )
  }

  test('should render correct number of times', async () => {
    render(<A />)
    expect(afn).toHaveBeenCalledTimes(1)
    const btnA = screen.queryByRole('btnA')
    await userEvent.click(btnA!)
    const headingA = screen.queryByRole('headingA')
    expect(headingA?.textContent).toContain(1)
    expect(afn).toHaveBeenCalledTimes(2)

    expect(bfn).toHaveBeenCalledTimes(2)
    const btnB = screen.queryByRole('btnB')
    await userEvent.click(btnB!)
    await userEvent.click(btnB!)
    expect(afn).toHaveBeenCalledTimes(2)
    expect(bfn).toHaveBeenCalledTimes(4)
    const headingB = screen.queryByRole('headingB')
    expect(headingB?.textContent).toContain(2)
  })
})
