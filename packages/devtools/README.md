# @pinia-react/devtools

Redux DevTools Extension integration for [pinia-react](https://www.npmjs.com/package/pinia-react).

```ts
import { createPinia } from 'pinia-react'
import { devtoolsPlugin } from '@pinia-react/devtools'

const pinia = createPinia()

if (import.meta.env.DEV) {
  pinia.use(devtoolsPlugin())
}
```

Enable individual stores explicitly:

```ts
defineStore('app', {
  state: () => ({ count: 0 }),
  devtools: {
    enabled: true,
    name: 'Application'
  }
})
```
