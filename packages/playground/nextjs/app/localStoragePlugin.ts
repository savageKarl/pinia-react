import type { PiniaPlugin } from 'pinia-react'

const isBrowser = typeof window !== 'undefined'

export const localStoragePlugin: PiniaPlugin = ({ id, store }) => {
  // 1. 在服务端，什么也不做
  if (!isBrowser) {
    return
  }

  const storageKey = `pinia-store-${id}`

  // 2. 在客户端，异步恢复状态以防水合错误
  setTimeout(() => {
    try {
      const storedState = localStorage.getItem(storageKey)
      if (storedState) {
        store.$patch((state) => {
          Object.assign(state, JSON.parse(storedState))
        })
      }
    } catch (error) {
      console.error(`[pinia-plugin-persist] Failed to hydrate state for store "${id}"`, error)
    }
  }, 0)

  // 3. 订阅和方法可以同步设置
  store.$subscribe((state) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch (error) {
      console.error(`[pinia-plugin-persist] Failed to save state for store "${id}"`, error)
    }
  })

  return {
    save() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(store.$state))
        console.log(`[pinia-plugin-persist] Manually saved state for store "${id}"`)
      } catch (error) {
        console.error(`[pinia-plugin-persist] Failed to manually save state for store "${id}"`, error)
      }
    },
    clearPersistence() {
      localStorage.removeItem(storageKey)
      console.log(`[pinia-plugin-persist] Cleared persisted state for store "${id}"`)
    },
    get $isPersisted() {
      return localStorage.getItem(storageKey) !== null
    }
  }
}
