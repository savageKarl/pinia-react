import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createPinia, defineStore, setActivePinia } from '../src'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('getStore', () => {
  const { useStore, getStore } = defineStore('main', {
    state: () => ({ count: 0 }),
    actions: {
      increment() {
        this.count++
      }
    }
  })

  const incrementOutsideComponent = () => {
    const store = getStore()
    store.increment()
  }

  const renderFn = vi.fn()

  function TestComponent() {
    const store = useStore()
    renderFn()
    return (
      <div>
        <h1>count: {store.count}</h1>
        <button onClick={incrementOutsideComponent}>Increment</button>
      </div>
    )
  }

  test('updates component when state is changed via getStore', async () => {
    render(<TestComponent />)
    expect(screen.getByText(/count: 0/)).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(1)

    const button = screen.getByRole('button')
    await userEvent.click(button)

    expect(screen.getByText(/count: 1/)).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(2)

    await userEvent.click(button)

    expect(screen.getByText(/count: 2/)).toBeInTheDocument()
    expect(renderFn).toHaveBeenCalledTimes(3)
  })
})
