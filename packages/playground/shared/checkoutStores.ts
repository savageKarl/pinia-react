import type {} from '@pinia-react/devtools'
import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'
import {
  checkQuantity,
  checkShipping,
  defaults,
  problem,
  type Shipping,
  selection,
  shippingKey,
  submitOrder
} from './checkoutDomain'

export const inventory = defineStore('checkout-inventory', {
  state: () => ({ stock: defaults().stock }),
  devtools: { enabled: true, name: 'Checkout inventory' },
  actions: {
    reserve(quantity: number) {
      checkQuantity(quantity)
      if (quantity > this.stock) throw new Error('Not enough stock')
      this.stock -= quantity
    }
  }
})
export const preferences = defineStore('checkout-preferences', {
  state: () => ({ shipping: defaults().shipping, address: '' }),
  actions: {
    setShipping(shipping: Shipping) {
      checkShipping(shipping)
      this.shipping = shipping
    },
    setAddress(address: string) {
      this.address = address.slice(0, 120)
    }
  },
  persist: { key: shippingKey, pick: ['shipping'] },
  devtools: { enabled: true, name: 'Checkout preferences' }
})
export const cart = defineStore('checkout-cart', {
  state: () => ({ quantity: defaults().quantity }),
  devtools: { enabled: true, name: 'Checkout cart' },
  getters: {
    total(): number {
      const prefs = preferences.getStore()
      return selection(this.quantity, prefs.shipping, prefs.address).total
    },
    problem(): string {
      const prefs = preferences.getStore()
      return problem(this.quantity, inventory.getStore().stock, prefs.shipping, prefs.address)
    }
  },
  actions: {
    setQuantity(quantity: number) {
      checkQuantity(quantity)
      this.quantity = quantity
    }
  }
})
export const checkout = defineStore('checkout-order', {
  state: () => ({ status: defaults().status, message: '', receipt: '' }),
  devtools: { enabled: true, name: 'Checkout order' },
  getters: {
    canPlace(): boolean {
      return !cart.getStore().problem && this.status !== 'pending'
    }
  },
  actions: {
    async place(
      input: {
        readonly quantity: number
        readonly shipping: Shipping
        readonly address: string
        reserve: (quantity: number) => void
      },
      fail = false
    ) {
      if (!this.canPlace) return
      const order = selection(input.quantity, input.shipping, input.address)
      this.status = 'pending'
      this.message = ''
      this.receipt = ''
      try {
        const receipt = await submitOrder(order, fail)
        if (JSON.stringify(order) !== JSON.stringify(selection(input.quantity, input.shipping, input.address)))
          throw new Error('Selection changed; retry')
        input.reserve(order.quantity)
        this.receipt = receipt
        this.status = 'success'
      } catch (error) {
        this.message = error instanceof Error ? error.message : 'Order failed; retry'
        this.status = 'error'
      }
    }
  }
})
