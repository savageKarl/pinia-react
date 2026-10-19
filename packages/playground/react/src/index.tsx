import { devtoolsPlugin } from '@pinia-react/devtools'
import persistedState from '@pinia-react/persistedstate'
import { createPinia, PiniaProvider } from 'pinia-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../shared/playground.css'
import { App } from './App'

const pinia = createPinia()
  .use(persistedState)
  .use(devtoolsPlugin({ name: 'React playground' }))

createRoot(document.querySelector('#app')!).render(
  <StrictMode>
    <PiniaProvider pinia={pinia}>
      <App pinia={pinia} />
    </PiniaProvider>
  </StrictMode>
)
