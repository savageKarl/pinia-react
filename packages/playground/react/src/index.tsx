import { devtoolsPlugin } from '@pinia-react/devtools'
import persistedState from '@pinia-react/persistedstate'
import { PiniaProvider } from 'pinia-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../shared/playground.css'
import { App } from './App'

const plugins = [persistedState, devtoolsPlugin({ name: 'React playground' })]

createRoot(document.querySelector('#app')!).render(
  <StrictMode>
    <PiniaProvider plugins={plugins}>
      <App />
    </PiniaProvider>
  </StrictMode>
)
