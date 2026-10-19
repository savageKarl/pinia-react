import { createStore } from 'zustand/vanilla'
import type { CheckoutView } from '../../shared/Checkout'
import {
  checkQuantity,
  checkShipping,
  defaults,
  problem,
  type Shipping,
  selection,
  submitOrder
} from '../../shared/checkoutDomain'

export function createZustandCheckout() {
  const store = createStore<
    ReturnType<typeof defaults> &
      Pick<CheckoutView, 'setQuantity' | 'setShipping' | 'setAddress' | 'place'> & { view: () => CheckoutView }
  >((set, get) => ({
    ...defaults(),
    view(): CheckoutView {
      const state = get()
      const issue = problem(state.quantity, state.stock, state.shipping, state.address)
      return {
        ...state,
        ...selection(state.quantity, state.shipping, state.address),
        problem: issue,
        canPlace: !issue && state.status !== 'pending'
      }
    },
    setQuantity(quantity: number) {
      checkQuantity(quantity)
      set({ quantity })
    },
    setShipping(shipping: Shipping) {
      checkShipping(shipping)
      set({ shipping })
    },
    setAddress(address: string) {
      set({ address: address.slice(0, 120) })
    },
    async place(fail = false) {
      if (!get().view().canPlace) return
      const state = get()
      const order = selection(state.quantity, state.shipping, state.address)
      set({ status: 'pending', message: '', receipt: '' })
      try {
        const receipt = await submitOrder(order, fail)
        const current = get()
        if (JSON.stringify(order) !== JSON.stringify(selection(current.quantity, current.shipping, current.address)))
          throw new Error('Selection changed; retry')
        if (order.quantity > current.stock) throw new Error('Not enough stock')
        set({ stock: current.stock - order.quantity, receipt, status: 'success' })
      } catch (error) {
        set({ status: 'error', message: error instanceof Error ? error.message : 'Order failed; retry' })
      }
    }
  }))
  return store
}
