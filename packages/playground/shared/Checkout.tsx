'use client'

import { useId } from 'react'
import type { Shipping } from './checkoutDomain'
import { cart, checkout, inventory, preferences } from './checkoutStores'

export type CheckoutView = {
  quantity: number
  stock: number
  shipping: Shipping
  address: string
  total: number
  problem: string
  canPlace: boolean
  status: string
  message: string
  receipt: string
  setQuantity: (quantity: number) => void
  setShipping: (shipping: Shipping) => void
  setAddress: (address: string) => void
  place: (fail?: boolean) => Promise<void>
}
export function CheckoutForm({ label, view }: { label: string; view: CheckoutView }) {
  const id = useId()
  return (
    <div className='comparison-panel'>
      <h3>{label}</h3>
      <p>
        Notebook · $12.00 · Stock <strong data-testid='checkout-stock'>{view.stock}</strong>
      </p>
      <div className='preference-fields'>
        <label htmlFor={id + '-quantity'}>Quantity</label>
        <input
          id={id + '-quantity'}
          type='number'
          min={1}
          max={9}
          value={view.quantity}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (Number.isInteger(value) && value >= 1 && value <= 9) view.setQuantity(value)
          }}
        />
        <label htmlFor={id + '-shipping'}>Shipping</label>
        <select
          id={id + '-shipping'}
          value={view.shipping}
          onChange={(event) => view.setShipping(event.target.value as Shipping)}
        >
          <option value='pickup'>Pickup (free)</option>
          <option value='delivery'>Delivery ($5)</option>
        </select>
        <label htmlFor={id + '-address'}>Address (not saved)</label>
        <input
          id={id + '-address'}
          value={view.address}
          maxLength={120}
          onChange={(event) => view.setAddress(event.target.value)}
        />
      </div>
      <p data-testid='checkout-total'>
        Total: $<strong>{(view.total / 100).toFixed(2)}</strong>
      </p>
      <output aria-live='polite'>{view.problem || view.message || view.status}</output>
      {view.receipt && <p>{view.receipt}</p>}
      <div className='button-row'>
        <button type='button' className='button-primary' disabled={!view.canPlace} onClick={() => void view.place()}>
          Place order
        </button>
        <button
          type='button'
          className='button-secondary'
          disabled={!view.canPlace}
          onClick={() => void view.place(true)}
        >
          Simulate failed order
        </button>
      </div>
    </div>
  )
}
function SharedCartSummary() {
  const basket = cart.useStore()
  return (
    <p data-testid='checkout-shared'>
      Shared cart: {basket.quantity} notebook(s), $<strong>{(basket.total / 100).toFixed(2)}</strong>
    </p>
  )
}
export function CheckoutPanel() {
  const basket = cart.useStore()
  const prefs = preferences.useStore()
  const stock = inventory.useStore()
  const order = checkout.useStore()
  return (
    <section aria-label='Pinia-React checkout'>
      <CheckoutForm
        label='Pinia-React checkout'
        view={{
          quantity: basket.quantity,
          stock: stock.stock,
          shipping: prefs.shipping,
          address: prefs.address,
          total: basket.total,
          problem: basket.problem,
          canPlace: order.canPlace,
          status: order.status,
          message: order.message,
          receipt: order.receipt,
          setQuantity: basket.setQuantity,
          setShipping: prefs.setShipping,
          setAddress: prefs.setAddress,
          place: (fail) =>
            order.place(
              {
                get quantity() {
                  return basket.quantity
                },
                get shipping() {
                  return prefs.shipping
                },
                get address() {
                  return prefs.address
                },
                reserve: stock.reserve
              },
              fail
            )
        }}
      />
      <SharedCartSummary />
    </section>
  )
}
