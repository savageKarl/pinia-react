export const shippingKey = 'pinia:checkout-shipping'
export type Shipping = 'pickup' | 'delivery'
export type OrderStatus = 'idle' | 'pending' | 'error' | 'success'
export const defaults = () => ({
  quantity: 1,
  stock: 3,
  shipping: 'pickup' as Shipping,
  address: '',
  status: 'idle' as OrderStatus,
  message: '',
  receipt: ''
})
export function checkQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9)
    throw new Error('Quantity must be an integer from 1 to 9')
}
export function checkShipping(shipping: Shipping) {
  if (shipping !== 'pickup' && shipping !== 'delivery') throw new Error('Invalid shipping')
}
export function selection(quantity: number, shipping: Shipping, address: string) {
  return { quantity, shipping, address, total: quantity * 1200 + (shipping === 'delivery' ? 500 : 0) }
}
export function problem(quantity: number, stock: number, shipping: Shipping, address: string) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) return 'Not enough stock'
  if (shipping !== 'pickup' && shipping !== 'delivery') return 'Invalid shipping'
  return shipping === 'delivery' && !address.trim() ? 'Address required' : ''
}
export async function submitOrder(order: ReturnType<typeof selection>, fail: boolean) {
  await new Promise((resolve) => setTimeout(resolve, 30))
  if (fail) throw new Error('Synthetic network failure; retry')
  return order.quantity + ' notebook(s), ' + order.shipping + ', $' + (order.total / 100).toFixed(2)
}
