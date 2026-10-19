import { devtoolsPlugin } from '@pinia-react/devtools'
import persistedState from '@pinia-react/persistedstate'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createPinia, disposePinia, PiniaProvider } from 'pinia-react'
import { StrictMode } from 'react'
import { App } from '../src/App'
import { preferenceKey } from '../src/preferences'

const owners: ReturnType<typeof createPinia>[] = []
function playground() {
  const pinia = createPinia()
    .use(persistedState)
    .use(devtoolsPlugin({ name: 'React playground' }))
  owners.push(pinia)
  return render(
    <StrictMode>
      <PiniaProvider pinia={pinia}>
        <App pinia={pinia} />
      </PiniaProvider>
    </StrictMode>
  )
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  for (const pinia of owners.splice(0)) disposePinia(pinia)
  vi.restoreAllMocks()
})

it('starts with one focused example and updates actions, getters and reset together', () => {
  playground()
  expect(screen.getByTestId('counter-value')).toHaveTextContent('0')
  expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '+1' }))
  expect(screen.getByTestId('counter-value')).toHaveTextContent('1')
  expect(screen.getByTestId('counter-double')).toHaveTextContent('2')
  fireEvent.click(screen.getByRole('button', { name: 'Reset to 0' }))
  expect(screen.getByTestId('counter-value')).toHaveTextContent('0')
})

it('shares one store between components and keeps it when switching examples', () => {
  playground()
  fireEvent.click(screen.getByRole('button', { name: /Shared state/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Component A: +1' }))
  expect(screen.getAllByTestId('shared-value').map((item) => item.textContent)).toEqual(['1', '1'])
  fireEvent.click(screen.getByRole('button', { name: 'Component B: +1' }))
  expect(screen.getAllByTestId('shared-value').map((item) => item.textContent)).toEqual(['2', '2'])
  fireEvent.click(screen.getByRole('button', { name: /State basics/ }))
  expect(screen.getByTestId('counter-value')).toHaveTextContent('2')
  expect(window.location.hash).toBe('#counter')
})

it('restores only selected preferences and keeps unsaved notes out of storage', () => {
  localStorage.setItem(preferenceKey, JSON.stringify({ name: 'Lin', theme: 'dark', note: 'not restored' }))
  const first = playground()
  fireEvent.click(screen.getByRole('button', { name: /Local storage/ }))
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Lin')
  expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('textbox', { name: 'Temporary note' })).toHaveValue('')
  fireEvent.change(screen.getByRole('textbox', { name: 'Display name' }), { target: { value: 'Mina' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Temporary note' }), { target: { value: 'only this visit' } })
  expect(JSON.parse(localStorage.getItem(preferenceKey)!)).toEqual({ name: 'Mina', theme: 'dark' })
  first.unmount()
  playground()
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Mina')
  expect(screen.getByRole('textbox', { name: 'Temporary note' })).toHaveValue('')
})

it('supports explicit restore, save and reset without touching unrelated browser data', () => {
  window.history.replaceState(null, '', '/#persistence')
  playground()
  localStorage.setItem('unrelated-user-key', 'keep')
  localStorage.setItem(preferenceKey, '{"name":"Restored","theme":"dark"}')
  fireEvent.click(screen.getByText('Manual save and restore'))
  fireEvent.click(screen.getByRole('button', { name: 'Restore from storage' }))
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Restored')
  localStorage.removeItem(preferenceKey)
  fireEvent.click(screen.getByRole('button', { name: 'Save now' }))
  expect(JSON.parse(localStorage.getItem(preferenceKey)!)).toEqual({ name: 'Restored', theme: 'dark' })
  fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }))
  expect(JSON.parse(localStorage.getItem(preferenceKey)!)).toEqual({ name: 'Ada', theme: 'light' })
  expect(localStorage.getItem('unrelated-user-key')).toBe('keep')
})

it('keeps editable state when a browser write fails and recovers on the next change', () => {
  window.history.replaceState(null, '', '/#persistence')
  playground()
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Display name' }), { target: { value: 'Still here' } })
  expect(screen.getByTestId('preference-name')).toHaveTextContent('Still here')
  write.mockRestore()
  fireEvent.change(screen.getByRole('textbox', { name: 'Display name' }), { target: { value: 'Saved again' } })
  expect(JSON.parse(localStorage.getItem(preferenceKey)!)).toEqual({ name: 'Saved again', theme: 'light' })
})

it('restores DevTools state through the real plugin without sending it back', async () => {
  let dispatch!: (message: unknown) => void
  const connection = {
    init: vi.fn(),
    send: vi.fn(),
    subscribe: vi.fn((listener) => {
      dispatch = listener
    })
  }
  Object.defineProperty(window, '__REDUX_DEVTOOLS_EXTENSION__', {
    configurable: true,
    value: { connect: () => connection }
  })
  try {
    window.history.replaceState(null, '', '/#persistence')
    playground()
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    const sent = connection.send.mock.calls.length
    await act(async () => {
      dispatch({
        type: 'DISPATCH',
        payload: { type: 'JUMP_TO_STATE' },
        state: JSON.stringify({ name: 'Time travel', theme: 'light', note: '' })
      })
    })
    expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Time travel')
    expect(JSON.parse(localStorage.getItem(preferenceKey)!)).toEqual({ name: 'Time travel', theme: 'light' })
    expect(connection.send).toHaveBeenCalledTimes(sent)
  } finally {
    Reflect.deleteProperty(window, '__REDUX_DEVTOOLS_EXTENSION__')
  }
})

it('keeps the same diagnostic definitions when switching examples', async () => {
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  playground()
  fireEvent.click(screen.getByRole('button', { name: /Tracking diagnostics/ }))
  await screen.findByRole('status')
  fireEvent.click(screen.getByRole('button', { name: 'Increment count' }))
  expect(screen.getByRole('status')).toHaveTextContent('total 2')
  fireEvent.click(screen.getByRole('button', { name: /State basics/ }))
  fireEvent.click(screen.getByRole('button', { name: /Tracking diagnostics/ }))
  expect(await screen.findByRole('status')).toHaveTextContent('total 2')
})
