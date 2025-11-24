import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'
import { createPinia } from 'pinia-react'

const pinia = createPinia()

pinia.use(({ store, id }) => {
  ;(store as any).secretKey = `SECRET_${id.toUpperCase()}`
  store.$subscribe(() => {
    console.log(`[PersistencePlugin] Saving state for ${id}`)
  })
})

createRoot(document.querySelector('#app')!).render(
  // <StrictMode>
  //   <App />
  // </StrictMode>
  <App />
)
