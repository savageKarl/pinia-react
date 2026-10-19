import persistedState from '@pinia-react/persistedstate'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createPinia, disposePinia, type Pinia, PiniaProvider } from 'pinia-react'
import { renderToString } from 'react-dom/server'
import { CheckoutPanel } from '../../shared/Checkout'
import * as domain from '../../shared/checkoutDomain'
import { shippingKey } from '../../shared/checkoutDomain'
import { cart, checkout, inventory, preferences } from '../../shared/checkoutStores'
import { CheckoutComparison } from '../src/CheckoutComparison'
import { createZustandCheckout } from '../src/checkoutZustand'

const owners = new Set<Pinia>()
function owner() {
  const pinia = createPinia()
  owners.add(pinia)
  return pinia
}
function checkoutInput(pinia: Pinia) {
  const basket = cart.getStore(pinia)
  const prefs = preferences.getStore(pinia)
  return {
    get quantity() {
      return basket.quantity
    },
    get shipping() {
      return prefs.shipping
    },
    get address() {
      return prefs.address
    },
    reserve: inventory.getStore(pinia).reserve
  }
}
afterEach(() => {
  for (const pinia of owners) disposePinia(pinia)
  owners.clear()
  localStorage.clear()
})

it('uses real Actions for quantity, inventory, preference and multi-hop checkout dependencies', async () => {
  const pinia = owner()
  const basket = cart.getStore(pinia)
  const order = checkout.getStore(pinia)
  expect(order.canPlace).toBe(true)
  basket.setQuantity(4)
  expect(order.canPlace).toBe(false)
  expect(() => basket.setQuantity(-1)).toThrow()
  expect(() => basket.setQuantity(1.5)).toThrow()
  basket.setQuantity(2)
  preferences.getStore(pinia).setShipping('delivery')
  expect(basket.total).toBe(2900)
  expect(order.canPlace).toBe(false)
  preferences.getStore(pinia).setAddress('Synthetic address')
  expect(order.canPlace).toBe(true)
  await order.place(checkoutInput(pinia), true)
  expect(order.status).toBe('error')
  expect(inventory.getStore(pinia).stock).toBe(3)
  expect(order.canPlace).toBe(true)
  const pending = order.place(checkoutInput(pinia))
  expect(order.status).toBe('pending')
  expect(order.canPlace).toBe(false)
  await order.place(checkoutInput(pinia))
  await pending
  expect(order.receipt).toBe('2 notebook(s), delivery, $29.00')
  expect(inventory.getStore(pinia).stock).toBe(1)
  expect(order.canPlace).toBe(false)
  const other = owner()
  expect(checkout.getStore(other).receipt).toBe('')
})

it.each([
  ['quantity', 1],
  ['shipping', 2],
  ['address', 2]
] as const)('does not reserve stock when %s changes during a request', async (field, remaining) => {
  const pinia = owner()
  const order = checkout.getStore(pinia)
  const prefs = preferences.getStore(pinia)
  prefs.setAddress('Initial address')
  const input = checkoutInput(pinia)
  const pending = order.place(input)
  if (field === 'quantity') cart.getStore(pinia).setQuantity(2)
  if (field === 'shipping') prefs.setShipping('delivery')
  if (field === 'address') prefs.setAddress('Changed address')
  await pending
  expect(order.message).toBe('Selection changed; retry')
  expect(inventory.getStore(pinia).stock).toBe(3)
  await order.place(input)
  expect(inventory.getStore(pinia).stock).toBe(remaining)
})

it('persists shipping in the business flow without persisting address, receipt or inventory', () => {
  const first = owner().use(persistedState)
  preferences.getStore(first).setShipping('delivery')
  preferences.getStore(first).setAddress('Not persisted')
  expect(JSON.parse(localStorage.getItem(shippingKey)!)).toEqual({ shipping: 'delivery' })
  const second = owner().use(persistedState)
  expect(preferences.getStore(second).shipping).toBe('delivery')
  expect(preferences.getStore(second).address).toBe('')
  expect(cart.getStore(second).total).toBe(1700)
  expect(checkout.getStore(second).canPlace).toBe(false)
})

it('renders the same business flow from request initialStores without leaking between requests', () => {
  for (const quantity of [1, 2, 3]) {
    const html = renderToString(
      <PiniaProvider
        initialStores={{
          'checkout-cart': { quantity },
          'checkout-preferences': { shipping: 'delivery', address: '' }
        }}
        plugins={[
          ({ pinia }) => {
            owners.add(pinia)
          }
        ]}
      >
        <CheckoutPanel />
      </PiniaProvider>
    )
    expect(html).toContain('>' + (quantity * 12 + 5).toFixed(2) + '</strong>')
    expect(html).toContain('Address required')
  }
})

it('runs identical UI inputs, failure and recovery for both implementations', async () => {
  render(
    <PiniaProvider pinia={owner()}>
      <CheckoutComparison />
    </PiniaProvider>
  )
  for (const label of ['Pinia-React checkout', 'Zustand checkout']) {
    const panel = within(screen.getByRole('region', { name: label }))
    fireEvent.change(panel.getByLabelText('Quantity'), { target: { value: '2' } })
    fireEvent.change(panel.getByLabelText('Shipping'), { target: { value: 'delivery' } })
    expect(panel.getByRole('button', { name: 'Place order' })).toBeDisabled()
    fireEvent.change(panel.getByLabelText('Address (not saved)'), { target: { value: 'Synthetic address' } })
    fireEvent.click(panel.getByRole('button', { name: 'Simulate failed order' }))
    await panel.findByText('Synthetic network failure; retry')
    fireEvent.click(panel.getByRole('button', { name: 'Place order' }))
    await panel.findByText('2 notebook(s), delivery, $29.00')
    expect(panel.getByTestId('checkout-stock')).toHaveTextContent('1')
    expect(panel.getByTestId('checkout-shared')).toHaveTextContent('2 notebook(s)')
  }
})

it('keeps independent Zustand instances and the same input constraints', () => {
  const first = createZustandCheckout()
  const second = createZustandCheckout()
  first.getState().setQuantity(4)
  expect(first.getState().view().canPlace).toBe(false)
  expect(second.getState().quantity).toBe(1)
  const pinia = owner()
  const piniaCart = cart.getStore(pinia)
  for (const quantity of [0, NaN, 1.5, -1, 10]) {
    expect(() => first.getState().setQuantity(quantity)).toThrow('Quantity must be an integer from 1 to 9')
    expect(() => piniaCart.setQuantity(quantity)).toThrow('Quantity must be an integer from 1 to 9')
  }
  expect(first.getState().quantity).toBe(4)
  expect(piniaCart.quantity).toBe(1)
})

it('injects a failed request with a framework spy while keeping the real checkout Action', async () => {
  const pinia = owner()
  const order = checkout.getStore(pinia)
  const request = vi.spyOn(domain, 'submitOrder').mockRejectedValueOnce(new Error('Injected failure'))
  try {
    await order.place(checkoutInput(pinia))
    expect(request).toHaveBeenCalledOnce()
    expect(order.message).toBe('Injected failure')
    expect(order.status).toBe('error')
    await order.place(checkoutInput(pinia))
    expect(order.status).toBe('success')
  } finally {
    request.mockRestore()
  }
})

it('rejects an in-flight checkout after its owner is disposed, without swallowing stale-reference errors', async () => {
  const pinia = owner()
  const pending = checkout.getStore(pinia).place(checkoutInput(pinia))
  disposePinia(pinia)
  await expect(pending).rejects.toThrow()
})

it('keeps explicit business inputs request-bound before and after await despite another active instance', async () => {
  const first = owner()
  const order = checkout.getStore(first)
  const input = checkoutInput(first)
  const args: unknown[][] = []
  first.onMutation(({ meta }) => {
    if (meta.action === 'place' && meta.args) args.push(meta.args)
  })
  const second = owner()
  preferences.getStore(second).setShipping('delivery')
  cart.getStore(second).setQuantity(4)
  expect(order.canPlace).toBe(true)
  const pending = order.place(input)
  preferences.getStore(second).setAddress('Other request')
  await pending
  expect(order.status).toBe('success')
  expect(inventory.getStore(first).stock).toBe(2)
  expect(inventory.getStore(second).stock).toBe(3)
  expect(checkout.getStore(second).receipt).toBe('')
  expect(args.length).toBeGreaterThan(0)
  for (const value of args) {
    expect(JSON.parse(JSON.stringify(value))).toEqual([{ quantity: 1, shipping: 'pickup', address: '' }])
  }
})

it('renders the checkout using only the standard PiniaProvider and the four business Stores', () => {
  const ids: string[] = []
  const pinia = owner().use(({ id }) => {
    ids.push(id)
  })
  const html = renderToString(
    <PiniaProvider pinia={pinia}>
      <CheckoutPanel />
    </PiniaProvider>
  )
  expect(html).toContain('12.00')
  expect(ids.sort()).toEqual(['checkout-cart', 'checkout-inventory', 'checkout-order', 'checkout-preferences'])
})
