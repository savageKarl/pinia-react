import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createPinia, defineStore, setActivePinia } from '../src'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('Comprehensive Component Tests', () => {
  const { useStore: useStoreA } = defineStore('storeA', {
    state: () => ({ count: 0 }),
    actions: {
      increment() {
        this.count++
      }
    }
  })

  const { useStore: useStoreB } = defineStore('storeB', {
    state: () => ({ count: 0 }),
    actions: {
      increment() {
        this.count++
      }
    }
  })

  const componentARenderFn = vi.fn()
  function ComponentA() {
    const storeA = useStoreA()
    componentARenderFn()
    return (
      <div>
        <h1 data-testid='countA'>{storeA.count}</h1>
        <button onClick={storeA.increment}>Increment A</button>
        <ComponentB />
      </div>
    )
  }

  const componentBRenderFn = vi.fn()
  function ComponentB() {
    const storeB = useStoreB()
    componentBRenderFn()
    return (
      <div>
        <h1 data-testid='countB'>{storeB.count}</h1>
        <button onClick={storeB.increment}>Increment B</button>
      </div>
    )
  }

  test('should render and update independently', async () => {
    render(<ComponentA />)

    expect(componentARenderFn).toHaveBeenCalledTimes(1)
    expect(componentBRenderFn).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('countA').textContent).toBe('0')
    expect(screen.getByTestId('countB').textContent).toBe('0')

    await userEvent.click(screen.getByText('Increment A'))

    expect(componentARenderFn).toHaveBeenCalledTimes(2)
    expect(componentBRenderFn).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('countA').textContent).toBe('1')
    expect(screen.getByTestId('countB').textContent).toBe('0')

    await userEvent.click(screen.getByText('Increment B'))
    await userEvent.click(screen.getByText('Increment B'))

    expect(componentARenderFn).toHaveBeenCalledTimes(2)
    expect(componentBRenderFn).toHaveBeenCalledTimes(3)
    expect(screen.getByTestId('countA').textContent).toBe('1')
    expect(screen.getByTestId('countB').textContent).toBe('2')
  })
})
