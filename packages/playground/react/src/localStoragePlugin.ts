import type { PiniaPlugin } from 'pinia-react'

export const localStoragePlugin: PiniaPlugin = ({ id, store }) => {
  const storageKey = `pinia-store-${id}`

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
