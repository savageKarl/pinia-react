import {
  type CookieOptions,
  type CookiePersistenceOptions,
  type CookieReader,
  type CookieSnapshot,
  createCookiePersistedState,
  readCookieSnapshot
} from '@pinia-react/persistedstate/next'
import { defineStore, type PiniaPlugin } from 'pinia-react'

const reader: CookieReader = { get: () => ({ value: '%7B%22count%22%3A4%7D' }) }
const cookies: CookieSnapshot = readCookieSnapshot(reader, ['app:counter'])
const cookieOptions: CookieOptions = { path: '/', sameSite: 'lax', secure: true, maxAge: 3600 }
const options: CookiePersistenceOptions = { cookies, cookieOptions, key: (key) => `app:${key}`, auto: true }
const plugin: PiniaPlugin = createCookiePersistedState(options)
void plugin
const { getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0, preferences: { theme: 'light' } }),
  getters: { double: (state) => state.count * 2 },
  actions: {
    increment(amount: number) {
      this.count += amount
      return this.count
    }
  },
  persist: {
    pick: ['count', 'preferences.theme'],
    afterHydrate({ store }) {
      const double: number = store.double
      const increment: (amount: number) => number = store.increment
      void double
      void increment
      // @ts-expect-error Cookie entry preserves concrete Store inference.
      store.increment('wrong')
    }
  }
})
const double: number = getCounterStore().double
void double
// @ts-expect-error Explicit request snapshot is required.
createCookiePersistedState({})
// @ts-expect-error Cookie factory never accepts a different storage backend.
createCookiePersistedState({ cookies, storage: localStorage })
// @ts-expect-error Async Cookie readers must be awaited before calling this helper.
readCookieSnapshot({ get: async () => ({ value: '' }) }, ['counter'])
// @ts-expect-error Browser-managed preference cookies cannot be HttpOnly.
createCookiePersistedState({ cookies, cookieOptions: { httpOnly: true } })
// @ts-expect-error Cookie lifetime is numeric seconds.
createCookiePersistedState({ cookies, cookieOptions: { maxAge: '3600' } })
