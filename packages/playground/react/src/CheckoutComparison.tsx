import { useState } from 'react'
import { useStore } from 'zustand'
import { CheckoutForm, CheckoutPanel } from '../../shared/Checkout'
import { Example } from '../../shared/playground'
import { createZustandCheckout } from './checkoutZustand'

function ZustandSummary({ store }: { store: ReturnType<typeof createZustandCheckout> }) {
  const state = useStore(store)
  return (
    <p data-testid='checkout-shared'>
      Shared cart: {state.quantity} notebook(s), $<strong>{(state.view().total / 100).toFixed(2)}</strong>
    </p>
  )
}

function ZustandPanel() {
  const [store] = useState(createZustandCheckout)
  // This form reads every field; both forms intentionally subscribe to all displayed business values.
  const state = useStore(store)
  return (
    <section aria-label='Zustand checkout'>
      <CheckoutForm label='Zustand checkout' view={state.view()} />
      <ZustandSummary store={store} />
    </section>
  )
}
export function CheckoutComparison() {
  return (
    <Example
      number='06'
      title='One checkout, shared business rules.'
      description='Quantity, stock and delivery preferences drive eligibility. Try failure, then retry. The same form and synthetic network run in both implementations. Only the Pinia shipping preference is persisted; Next uses the same business flow with request cookies.'
      file='shared/checkoutStores.ts → Checkout.tsx'
      code={`inventory + preferences → cart getters → checkout Action
Same form, price, stock, validation and 30 ms synthetic request.
Pinia: four Stores, owner-bound cross-Store getters.
Zustand: one vanilla Store, explicit derived reads.`}
    >
      <div className='comparison-grid'>
        <CheckoutPanel />
        <ZustandPanel />
      </div>
    </Example>
  )
}
