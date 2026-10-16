'use client'

import { defineStore } from 'pinia-react'
import { Example, StatePreview } from '../../shared/playground'
import { PreferenceActions, PreferenceEditor } from '../../shared/preferences'
import { preferenceDefaults, preferenceKey } from './persistence'

export const { usePreferencesStore } = defineStore('preferences', {
  state: () => ({ ...preferenceDefaults }),
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
  persist: { key: preferenceKey, pick: ['name', 'theme'] }
})

export function CookiePreferences() {
  const preferences = usePreferencesStore()
  return (
    <Example
      number='03'
      title='Bring your preferences to the server.'
      description='Save preferences in a cookie so the next server render remembers them. Change them and reload; notes stay in memory.'
      file='app/layout.tsx → providers.tsx'
      code={`// layout.tsx: read only this demo cookie
const snapshot = readCookieSnapshot(
  await cookies(), ['pinia:preferences']
)

// providers.tsx: capture the initial request snapshot
const [persistence] = useState(() =>
  createCookiePersistedState({ cookies: snapshot })
)

<PiniaProvider plugins={[persistence]}>
  {children}
</PiniaProvider>

// preferences.tsx: use the same store options
persist: {
  key: 'pinia:preferences',
  pick: ['name', 'theme']
}`}
    >
      <PreferenceEditor
        name={preferences.name}
        theme={preferences.theme}
        note={preferences.note}
        onNameChange={preferences.setName}
        onThemeChange={preferences.setTheme}
        onNoteChange={preferences.setNote}
      />
      <PreferenceActions
        onSave={() => preferences.$persist?.()}
        onRestore={() => preferences.$hydrate?.()}
        onReset={() => preferences.$reset()}
      />
      <StatePreview state={preferences.$state} />
    </Example>
  )
}
