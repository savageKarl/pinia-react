/** biome-ignore-all lint/suspicious/noDocumentCookie: Test only the demo preference cookie. */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { App } from '../app/App'
import { preferenceDefaults, preferenceKey } from '../app/persistence'
import Providers from '../app/providers'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

function tree(example: 'counter' | 'sharing' | 'persistence' = 'counter', cookies = {}) {
  return (
    <Providers cookies={cookies} initialStores={{ counter: { count: 10 }, preferences: { ...preferenceDefaults } }}>
      <App example={example} />
    </Providers>
  )
}

beforeEach(() => {
  document.cookie = `${encodeURIComponent(preferenceKey)}=; Max-Age=0; Path=/`
  refresh.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('starts from server state and distinguishes it from factory reset defaults', () => {
  render(tree())
  expect(screen.getByTestId('counter-value')).toHaveTextContent('10')
  fireEvent.click(screen.getByRole('button', { name: '+1' }))
  expect(screen.getByTestId('counter-value')).toHaveTextContent('11')
  expect(screen.getByTestId('counter-double')).toHaveTextContent('22')
  fireEvent.click(screen.getByRole('button', { name: 'Reset to 0' }))
  expect(screen.getByTestId('counter-value')).toHaveTextContent('0')
})

it('shares the root Provider across page views and ignores replacement initialization props', () => {
  const view = render(tree('sharing'))
  fireEvent.click(screen.getByRole('button', { name: 'Component A: +1' }))
  view.rerender(tree('counter', { [preferenceKey]: '{"name":"New request","theme":"dark"}' }))
  expect(screen.getByTestId('counter-value')).toHaveTextContent('11')
  view.rerender(tree('sharing'))
  expect(screen.getAllByTestId('shared-value').map((item) => item.textContent)).toEqual(['11', '11'])
  expect(screen.getByRole('link', { name: 'Open another page' })).toHaveAttribute('href', '/details')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh server data' }))
  expect(refresh).toHaveBeenCalledOnce()
})

it('restores the captured request without initial writes and persists only selected fields', () => {
  document.cookie = `${encodeURIComponent(preferenceKey)}=${encodeURIComponent('{"name":"New browser","theme":"light"}')}; Path=/`
  render(
    <StrictMode>
      {tree('persistence', { [preferenceKey]: '{"name":"From request","theme":"dark","note":"ignored"}' })}
    </StrictMode>
  )
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('From request')
  expect(screen.getByRole('textbox', { name: 'Temporary note' })).toHaveValue('')
  expect(decodeURIComponent(document.cookie)).toContain('New browser')
  fireEvent.change(screen.getByRole('textbox', { name: 'Temporary note' }), { target: { value: 'only in memory' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Display name' }), { target: { value: 'Saved cookie' } })
  expect(decodeURIComponent(document.cookie)).toContain('"name":"Saved cookie"')
  expect(decodeURIComponent(document.cookie)).not.toContain('note')
  expect(screen.getByRole('link', { name: /Cookie storage/ })).toHaveAttribute('aria-current', 'page')
})

it('rereads browser cookies explicitly and resets without deleting unrelated cookies', () => {
  render(tree('persistence'))
  document.cookie = `${encodeURIComponent(preferenceKey)}=${encodeURIComponent('{"name":"Browser","theme":"dark"}')}; Path=/`
  fireEvent.click(screen.getByText('Manual save and restore'))
  fireEvent.click(screen.getByRole('button', { name: 'Restore from storage' }))
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Browser')
  document.cookie = 'unrelated-demo-cookie=keep; Path=/'
  fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }))
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Ada')
  expect(decodeURIComponent(document.cookie)).toContain('"theme":"light"')
  expect(document.cookie).toContain('unrelated-demo-cookie=keep')
  document.cookie = 'unrelated-demo-cookie=; Max-Age=0; Path=/'
})

it('hydrates server preferences without mismatch despite a newer browser cookie', async () => {
  const view = tree('persistence', { [preferenceKey]: '{"name":"Server Ada","theme":"dark"}' })
  const container = document.createElement('div')
  const browserWindow = globalThis.window
  vi.stubGlobal('window', undefined)
  try {
    container.innerHTML = renderToString(view)
  } finally {
    vi.stubGlobal('window', browserWindow)
  }
  document.cookie = `${encodeURIComponent(preferenceKey)}=${encodeURIComponent('{"name":"Browser Lin","theme":"light"}')}; Path=/`
  document.body.append(container)
  const recoverable = vi.fn()
  let root!: ReturnType<typeof hydrateRoot>
  try {
    await act(async () => {
      root = hydrateRoot(container, view, { onRecoverableError: recoverable })
    })
    expect(screen.getByTestId('preference-name')).toHaveTextContent('Server Ada')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    expect(recoverable).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Display name' }), { target: { value: 'Updated' } })
    expect(decodeURIComponent(document.cookie)).toContain('"name":"Updated"')
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
})

it('falls back from invalid request cookies and can save valid preferences afterward', () => {
  render(tree('persistence', { [preferenceKey]: 'broken-json' }))
  expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Ada')
  fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
  expect(decodeURIComponent(document.cookie)).toContain('"theme":"dark"')
  expect(screen.getByRole('link', { name: /Server state/ })).toHaveAttribute('href', '/')
})
