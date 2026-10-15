// @vitest-environment node
import { createPinia, defineStore } from 'pinia-react'
import { devtoolsPlugin } from '../src'

it('keeps opted-in stores usable without a browser extension or window', () => {
  createPinia().use(devtoolsPlugin())
  const { getStore } = defineStore('ssr-devtools', { state: () => ({ count: 0 }), devtools: { enabled: true } })
  const store = getStore()
  store.$patch({ count: 1 })
  expect(store.count).toBe(1)
})
