import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createPinia, defineStore, setActivePinia } from '../src'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('Comprehensive Component Rendering Tests', () => {
  const { useStore: useStoreA } = defineStore('storeA', {
    state: () => ({
      count: 0,
      unused: 'initial'
    }),
    actions: {
      increment() {
        this.count++
      },
      updateUnused() {
        this.unused = 'updated'
      }
    }
  })

  const { useStore: useStoreB } = defineStore('storeB', {
    state: () => ({ value: 100 }),
    actions: {
      double() {
        this.value *= 2
      }
    }
  })

  const componentARenderFn = vi.fn()
  function ComponentA() {
    const storeA = useStoreA()
    componentARenderFn()
    return (
      <div>
        <span data-testid='countA'>{storeA.count}</span>
        <button onClick={storeA.increment}>Increment A</button>
        <button onClick={storeA.updateUnused}>Update Unused A</button>
      </div>
    )
  }

  const componentBRenderFn = vi.fn()
  function ComponentB() {
    const storeB = useStoreB()
    componentBRenderFn()
    return (
      <div>
        <span data-testid='valueB'>{storeB.value}</span>
        <button onClick={storeB.double}>Double B</button>
      </div>
    )
  }

  function App() {
    return (
      <>
        <ComponentA />
        <ComponentB />
      </>
    )
  }

  beforeEach(() => {
    componentARenderFn.mockClear()
    componentBRenderFn.mockClear()
  })

  test('components should render and update independently', async () => {
    render(<App />)

    expect(componentARenderFn).toHaveBeenCalledTimes(1)
    expect(componentBRenderFn).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('countA').textContent).toBe('0')
    expect(screen.getByTestId('valueB').textContent).toBe('100')

    await userEvent.click(screen.getByText('Increment A'))

    expect(componentARenderFn).toHaveBeenCalledTimes(2)
    expect(componentBRenderFn).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('countA').textContent).toBe('1')
    expect(screen.getByTestId('valueB').textContent).toBe('100')

    await userEvent.click(screen.getByText('Double B'))
    await userEvent.click(screen.getByText('Double B'))

    expect(componentARenderFn).toHaveBeenCalledTimes(2)
    expect(componentBRenderFn).toHaveBeenCalledTimes(3)
    expect(screen.getByTestId('countA').textContent).toBe('1')
    expect(screen.getByTestId('valueB').textContent).toBe('400')
  })

  test('component should not re-render if unused state is updated', async () => {
    render(<App />)
    expect(componentARenderFn).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByText('Update Unused A'))

    expect(componentARenderFn).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('countA').textContent).toBe('0')
  })
})
