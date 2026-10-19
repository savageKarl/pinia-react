import { hydrateRoot } from 'react-dom/client'
import { createFixture } from './hydration'
import { checkLifecycleFixture } from './lifecycle'

const fixture = createFixture(true)
const recoverable: string[] = []
const root = hydrateRoot(document.getElementById('root')!, fixture.tree, {
  onRecoverableError(error) {
    recoverable.push(String(error))
  }
})
declare global {
  interface Window {
    hydrationProbe: typeof fixture & {
      recoverable: string[]
      unmount: () => void
      checkLifecycle: typeof checkLifecycleFixture
    }
  }
}
window.hydrationProbe = {
  ...fixture,
  recoverable,
  unmount: () => root.unmount(),
  checkLifecycle: checkLifecycleFixture
}
