import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'
import { createPinia } from 'pinia-react'
import { localStoragePlugin } from './localStoragePlugin'

const pinia = createPinia()

pinia.use(({ store, id }) => {
  ;(store as any).secretKey = `SECRET_${id.toUpperCase()}`
  store.$subscribe(() => {
    console.log(`[PersistencePlugin] Saving state for ${id}`)
  })
})

pinia.use(localStoragePlugin)

createRoot(document.querySelector('#app')!).render(<App />)
