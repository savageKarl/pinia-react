import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createPinia, defineStore, setActivePinia } from '../src'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('Complex Component Interaction Tests', () => {
  /**
   * 场景一：深度嵌套状态与精确的组件重渲染
   */
  describe('Scenario 1: Deeply Nested State and Precise Re-rendering', () => {
    const { useStore: useSettingsStore } = defineStore('settings', {
      state: () => ({
        user: {
          profile: { name: 'Alice', avatar: 'url_to_avatar' },
          preferences: { theme: 'dark', language: 'en' }
        },
        notifications: { count: 5, enabled: true }
      }),
      actions: {
        changeTheme(theme: 'dark' | 'light') {
          this.user.preferences.theme = theme
        },
        changeName(name: string) {
          this.user.profile.name = name
        },
        changeNameAndNotifications(name: string, count: number) {
          this.user.profile.name = name
          this.notifications.count = count
        }
      }
    })

    const userProfileRenderFn = vi.fn()
    function UserProfile() {
      const settings = useSettingsStore()
      userProfileRenderFn()
      return <p>User: {settings.user.profile.name}</p>
    }

    const themeSwitcherRenderFn = vi.fn()
    function ThemeSwitcher() {
      const settings = useSettingsStore()
      themeSwitcherRenderFn()
      return <button onClick={() => settings.changeTheme('light')}>Theme: {settings.user.preferences.theme}</button>
    }

    const notificationSettingsRenderFn = vi.fn()
    function NotificationSettings() {
      const settings = useSettingsStore()
      notificationSettingsRenderFn()
      return <span>Notifications: {settings.notifications.count}</span>
    }

    function App() {
      const settings = useSettingsStore()
      return (
        <div>
          <UserProfile />
          <ThemeSwitcher />
          <NotificationSettings />
          <button onClick={() => settings.changeName('Bob')}>Change Name</button>
          <button onClick={() => settings.changeNameAndNotifications('Charlie', 10)}>Change Both</button>
        </div>
      )
    }

    beforeEach(() => {
      userProfileRenderFn.mockClear()
      themeSwitcherRenderFn.mockClear()
      notificationSettingsRenderFn.mockClear()
    })

    test('should only re-render components whose specific nested state slice has changed', async () => {
      render(<App />)

      expect(userProfileRenderFn).toHaveBeenCalledTimes(1)
      expect(themeSwitcherRenderFn).toHaveBeenCalledTimes(1)
      expect(notificationSettingsRenderFn).toHaveBeenCalledTimes(1)

      await userEvent.click(screen.getByText(/Theme: dark/))

      expect(userProfileRenderFn).toHaveBeenCalledTimes(1)
      expect(themeSwitcherRenderFn).toHaveBeenCalledTimes(2)
      expect(notificationSettingsRenderFn).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/Theme: light/)).toBeInTheDocument()

      await userEvent.click(screen.getByText('Change Name'))

      expect(userProfileRenderFn).toHaveBeenCalledTimes(2)
      expect(themeSwitcherRenderFn).toHaveBeenCalledTimes(2)
      expect(notificationSettingsRenderFn).toHaveBeenCalledTimes(1)
      expect(screen.getByText('User: Bob')).toBeInTheDocument()

      await userEvent.click(screen.getByText('Change Both'))

      expect(userProfileRenderFn).toHaveBeenCalledTimes(3)
      expect(themeSwitcherRenderFn).toHaveBeenCalledTimes(2)
      expect(notificationSettingsRenderFn).toHaveBeenCalledTimes(2)
      expect(screen.getByText('User: Charlie')).toBeInTheDocument()
      expect(screen.getByText('Notifications: 10')).toBeInTheDocument()
    })
  })

  /**
   * 场景二：跨 Store 的复杂依赖与联动
   */
  describe('Scenario 2: Cross-Store Dependency and Updates', () => {
    const { useStore: useProductsStore, getStore: getProductsStore } = defineStore('products', {
      state: () => ({
        products: [{ id: 1, name: 'Laptop', price: 1000 }]
      }),
      actions: {
        updatePrice(productId: number, price: number) {
          const product = this.products.find((p) => p.id === productId)
          if (product) product.price = price
        }
      }
    })

    const { useStore: useCartStore } = defineStore('cart', {
      state: () => ({
        items: [{ productId: 1, quantity: 2 }]
      }),
      getters: {
        totalPrice(): number {
          const productsStore = getProductsStore()
          const item = this.items[0]
          const product = productsStore.products.find((p) => p.id === item.productId)
          return product ? product.price * item.quantity : 0
        }
      }
    })

    const shoppingCartRenderFn = vi.fn()
    function ShoppingCart() {
      const cart = useCartStore()
      shoppingCartRenderFn()
      return <div>Total: {cart.totalPrice}</div>
    }

    function ProductEditor() {
      const productsStore = useProductsStore()
      return <button onClick={() => productsStore.updatePrice(1, 1200)}>Update Laptop Price</button>
    }

    beforeEach(() => shoppingCartRenderFn.mockClear())

    test('component should update when a getter dependency from another store changes', async () => {
      render(
        <>
          <ShoppingCart />
          <ProductEditor />
        </>
      )

      expect(shoppingCartRenderFn).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Total: 2000')).toBeInTheDocument()

      await userEvent.click(screen.getByText('Update Laptop Price'))

      expect(shoppingCartRenderFn).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Total: 2400')).toBeInTheDocument()
    })
  })

  /**
   * 场景三：Getter 间的链式依赖与缓存验证
   */
  describe('Scenario 3: Chained Getters and Cache Invalidation', () => {
    const getterSpies = {
      subtotal: vi.fn(),
      totalWithTax: vi.fn(),
      finalPrice: vi.fn()
    }

    const { useStore: useOrderStore } = defineStore('order', {
      state: () => ({
        basePrice: 100,
        quantity: 2,
        taxRate: 0.1,
        shippingFee: 10
      }),
      getters: {
        subtotal(): number {
          const result = this.basePrice * this.quantity
          getterSpies.subtotal(result)
          return result
        },
        totalWithTax(): number {
          const result = this.subtotal * (1 + this.taxRate)
          getterSpies.totalWithTax(result)
          return result
        },
        finalPrice(): number {
          const result = this.totalWithTax + this.shippingFee
          getterSpies.finalPrice(result)
          return result
        }
      },
      actions: {
        setQuantity(q: number) {
          this.quantity = q
        },
        setShippingFee(fee: number) {
          this.shippingFee = fee
        }
      }
    })

    function OrderSummary() {
      const order = useOrderStore()
      return (
        <div>
          <p>Final Price: {order.finalPrice}</p>
          <button onClick={() => order.setQuantity(3)}>Update Quantity</button>
          <button onClick={() => order.setShippingFee(20)}>Update Shipping</button>
        </div>
      )
    }

    beforeEach(() => {
      vi.mocked(getterSpies.subtotal).mockClear()
      vi.mocked(getterSpies.totalWithTax).mockClear()
      vi.mocked(getterSpies.finalPrice).mockClear()
    })

    test('should re-calculate only necessary getters in a dependency chain', async () => {
      render(<OrderSummary />)

      expect(getterSpies.subtotal).toHaveBeenCalledTimes(1)
      expect(getterSpies.totalWithTax).toHaveBeenCalledTimes(1)
      expect(getterSpies.finalPrice).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Final Price: 230')).toBeInTheDocument()

      await userEvent.click(screen.getByText('Update Shipping'))

      expect(getterSpies.subtotal).toHaveBeenCalledTimes(1)
      expect(getterSpies.totalWithTax).toHaveBeenCalledTimes(1)
      expect(getterSpies.finalPrice).toHaveBeenCalledTimes(2)
      expect(screen.getByText('Final Price: 240')).toBeInTheDocument()

      await userEvent.click(screen.getByText('Update Quantity'))

      expect(getterSpies.subtotal).toHaveBeenCalledTimes(2)
      expect(getterSpies.totalWithTax).toHaveBeenCalledTimes(2)
      expect(getterSpies.finalPrice).toHaveBeenCalledTimes(3)
      expect(screen.getByText('Final Price: 350')).toBeInTheDocument()
    })
  })
})
