/** biome-ignore-all lint/suspicious/noDocumentCookie: Synthetic checkout cookie only. */
import * as cookiePersistence from '@pinia-react/persistedstate/next'
import { act, fireEvent, screen } from '@testing-library/react'
import { createPinia, disposePinia, getActivePinia, type Pinia } from 'pinia-react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { CheckoutPanel } from '../../shared/Checkout'
import { shippingKey } from '../../shared/checkoutDomain'
import Providers from '../app/providers'

it('hydrates the actual checkout from its request cookie, changes linked state and persists only shipping', async () => {
  const cookies = { [shippingKey]: JSON.stringify({ shipping: 'delivery', address: 'MUST_NOT_BE_RESTORED' }) }
  const tree = (
    <Providers
      cookies={cookies}
      initialStores={{
        'checkout-cart': { quantity: 2 },
        'checkout-inventory': { stock: 3 },
        'checkout-preferences': { shipping: 'pickup', address: '' }
      }}
    >
      <CheckoutPanel />
    </Providers>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  document.body.append(container)
  expect(container.textContent).toContain('29.00')
  expect(container.textContent).toContain('Address required')
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot> | undefined
  try {
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError: (error) => errors.push(error) })
    })
    expect(screen.getByLabelText('Shipping')).toHaveValue('delivery')
    expect(screen.getByLabelText('Address (not saved)')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Address (not saved)'), { target: { value: 'Synthetic address' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simulate failed order' }))
    await screen.findByText('Synthetic network failure; retry')
    fireEvent.click(screen.getByRole('button', { name: 'Place order' }))
    await screen.findByText('2 notebook(s), delivery, $29.00')
    expect(screen.getByTestId('checkout-stock')).toHaveTextContent('1')
    fireEvent.change(screen.getByLabelText('Shipping'), { target: { value: 'pickup' } })
    const saved = document.cookie.split('; ').find((value) => value.startsWith(encodeURIComponent(shippingKey) + '='))!
    expect(JSON.parse(decodeURIComponent(saved.slice(saved.indexOf('=') + 1)))).toEqual({ shipping: 'pickup' })
    expect(errors).toEqual([])
  } finally {
    act(() => root?.unmount())
    container.remove()
    document.cookie = encodeURIComponent(shippingKey) + '=; Max-Age=0; Path=/'
  }
})

it('does not replace the ambient Pinia while rendering a request-bound checkout on the server', () => {
  const ambient = createPinia()
  const browserWindow = globalThis.window
  vi.stubGlobal('window', undefined)
  try {
    const html = renderToString(
      <Providers cookies={{}} initialStores={{ 'checkout-cart': { quantity: 2 } }}>
        <CheckoutPanel />
      </Providers>
    )
    expect(html).toContain('24.00')
    expect(getActivePinia()).toBe(ambient)
  } finally {
    vi.stubGlobal('window', browserWindow)
    disposePinia(ambient)
  }
})

it('does not create a checkout Store just to bind an unrelated request route', () => {
  const owners = new Set<Pinia>()
  const ids: string[] = []
  const createPersistence = cookiePersistence.createCookiePersistedState
  const create = vi.spyOn(cookiePersistence, 'createCookiePersistedState').mockImplementation((options) => {
    const persist = createPersistence(options)
    return (context) => {
      owners.add(context.pinia)
      ids.push(context.id)
      return persist(context)
    }
  })
  const browserWindow = globalThis.window
  vi.stubGlobal('window', undefined)
  try {
    const html = renderToString(
      <Providers cookies={{}} initialStores={{}}>
        <p>Other route</p>
      </Providers>
    )
    expect(html).toContain('Other route')
    expect(ids).toEqual([])
  } finally {
    vi.stubGlobal('window', browserWindow)
    create.mockRestore()
    for (const pinia of owners) disposePinia(pinia)
  }
})
