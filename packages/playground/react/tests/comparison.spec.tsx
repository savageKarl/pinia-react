import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PiniaProvider } from 'pinia-react'
import { ComparisonDemo } from '../src/ComparisonDemo'
import { getComparisonStore, resetComparisonZustand, useZustandComparison } from '../src/comparisonStores'

beforeEach(() => {
  resetComparisonZustand()
})

it('keeps state in sync while making each library render boundary visible', () => {
  render(
    <PiniaProvider>
      <ComparisonDemo />
    </PiniaProvider>
  )

  expect(screen.getAllByText('renders 1')).toHaveLength(4)

  for (const button of screen.getAllByRole('button', { name: 'Change count' })) fireEvent.click(button)

  expect(screen.getAllByText('1')).toHaveLength(2)
  expect(screen.getAllByText('renders 2')).toHaveLength(2)
  expect(screen.getAllByText('renders 1')).toHaveLength(2)
  expect(getComparisonStore().count).toBe(useZustandComparison.getState().count)

  fireEvent.change(screen.getByRole('textbox', { name: 'Pinia-React profile name' }), { target: { value: 'Lin' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Zustand profile name' }), { target: { value: 'Lin' } })
  expect(screen.getAllByText('Lin')).toHaveLength(2)
  expect(getComparisonStore().name).toBe(useZustandComparison.getState().name)
})

it('compares derived cart state and asynchronous action completion', async () => {
  render(
    <PiniaProvider>
      <ComparisonDemo />
    </PiniaProvider>
  )

  for (const button of screen.getAllByRole('button', { name: 'Add item' })) fireEvent.click(button)
  expect(screen.getAllByText('2 items · $15')).toHaveLength(2)

  for (const button of screen.getAllByRole('button', { name: 'Load profile' })) fireEvent.click(button)
  expect(screen.getAllByText('Loading profile...')).toHaveLength(2)

  await waitFor(() => {
    expect(screen.getAllByText('Loaded preferences for Ada')).toHaveLength(2)
  })

  expect(getComparisonStore().$state).toEqual({
    count: useZustandComparison.getState().count,
    name: useZustandComparison.getState().name,
    items: useZustandComparison.getState().items,
    status: useZustandComparison.getState().status,
    message: useZustandComparison.getState().message
  })
})

it('resets both implementations from the comparison control', () => {
  render(
    <PiniaProvider>
      <ComparisonDemo />
    </PiniaProvider>
  )

  fireEvent.click(screen.getAllByRole('button', { name: 'Change count' })[0])
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Reset both implementations' }))
  })

  expect(getComparisonStore().count).toBe(0)
  expect(useZustandComparison.getState().count).toBe(0)
})
