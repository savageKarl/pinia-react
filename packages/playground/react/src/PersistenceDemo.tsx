import { Example, StatePreview } from '../../shared/playground'
import { PreferenceActions, PreferenceEditor } from '../../shared/preferences'
import { usePreferencesStore } from './preferences'

export function PersistenceDemo() {
  const preferences = usePreferencesStore()
  return (
    <Example
      number='03'
      title='Remembered after a reload.'
      description='Change your name and theme, then reload. Only selected fields are saved; your note stays in memory.'
      file='src/preferences.ts'
      code={`// index.tsx: register the plugin once
<PiniaProvider plugins={[persistedState]}>
  <App />
</PiniaProvider>

// preferences.ts: save only selected fields
defineStore('preferences', {
  state: () => ({
    name: 'Ada',
    theme: 'light',
    note: ''
  }),
  // Define actions as you would in any other store
  persist: {
    key: 'pinia-playground:preferences',
    pick: ['name', 'theme']
  }
})`}
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
