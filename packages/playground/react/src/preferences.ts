import { defineStore } from 'pinia-react'
import '@pinia-react/persistedstate'

export const preferenceKey = 'pinia-playground:preferences'

export const { usePreferencesStore } = defineStore('preferences', {
  state: () => ({ name: 'Ada', theme: 'light' as 'light' | 'dark', note: '' }),
  actions: {
    setName(name: string) {
      this.name = name
    },
    setTheme(theme: 'light' | 'dark') {
      this.theme = theme
    },
    setNote(note: string) {
      this.note = note
    }
  },
  persist: { key: preferenceKey, pick: ['name', 'theme'] },
  devtools: { enabled: true, name: 'Preferences' }
})
