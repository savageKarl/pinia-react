import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createPinia, defineStore, setActivePinia } from 'pinia-react'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('$getStore', () => {
  const useStore = defineStore('aStore', {
    state: () => ({ count: 0 })
  })

  const increment = () => {
    const store = useStore.$getStore()
    store.count++
  }

  const fn = vi.fn()

  function A() {
    const store = useStore()
    fn()
    return (
      <>
        <h1>count: {store.count}</h1>
        <button onClick={() => increment()}>add</button>
      </>
    )
  }

  test('should render correct number of times', async () => {
    render(<A></A>)
    const countText = screen.getByText(/0/)
    expect(countText).toBeInTheDocument()
    expect(fn).toHaveBeenCalledTimes(1)

    const button = screen.getByRole('button')
    await userEvent.click(button)
    expect(screen.getByText(/1/)).toBeInTheDocument()
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
