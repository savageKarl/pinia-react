import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './style.css'
import { createPinia } from '../../../src'

createPinia()

createRoot(document.querySelector('#app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
