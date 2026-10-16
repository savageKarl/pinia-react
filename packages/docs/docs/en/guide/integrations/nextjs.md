# Next.js App Router

Place one root PiniaProvider in a shared layout so it stays mounted during client navigation. Fetch request data in Server Components and pass plain JSON grouped by store ID. Keep useCounterStore and other store hooks in Client Components.

```tsx
// app/layout.tsx — Server Component
import { PiniaProvider } from 'pinia-react/next'
import type { ReactNode } from 'react'

export default async function Layout({ children }: { children: ReactNode }) {
  // Replace this example with your request's API or database query.
  const counter = await Promise.resolve({ count: 10 })
  return (
    <html lang='en'>
      <body>
        <PiniaProvider initialStores={{ counter }}>{children}</PiniaProvider>
      </body>
    </html>
  )
}
```

```tsx
// app/counter.tsx — Client Component
'use client'
import { defineStore } from 'pinia-react'

export const { useCounterStore, getCounterStore } = defineStore('counter', {
  state: () => ({ count: 0 }),
  actions: { increment() { this.count++ } }
})

export function Counter() {
  const store = useCounterStore()
  return <button onClick={() => store.increment()}>{store.count}</button>
}
```

## Initialization and lifetime

initialStores is a container keyed by the exact ID passed to defineStore. Each included store receives a complete JSON state snapshot; omitted stores use their own state() defaults. There is no deep merge. The snapshot is consumed lazily the first time that store is created, before plugins run, and pinia.state already contains the initial state at that point.

The Provider retains one Pinia instance throughout its lifetime. Ordinary prop updates, router.refresh(), and client navigation under the same layout do not reapply snapshots or overwrite client changes. Unmounting and remounting the Provider creates a new instance. $reset restores factory defaults rather than the server snapshot.

Hooks prefer their Provider context, then fall back to activePinia. In the browser the root Provider also sets activePinia so getCounterStore() remains available to client event handlers and non-hook code. Independent Providers with parameterless getCounterStore() are not supported; use one root Provider for an application.

## Server and client boundaries

Rendering a Provider on the server creates an isolated render instance without setting the process-wide activePinia. Do not create a module-level Pinia containing request or user data. Server Components query data and render the Provider; they do not call store hooks or getCounterStore(). Transfer JSON data only, never a Pinia instance, Store, Proxy, action, getter or Immer Draft.

State should use strings, finite numbers, booleans, null, plain objects and arrays. Convert dates and other domain objects to JSON before crossing this boundary. Date, Map, Set, class instances, functions and browser objects have no guaranteed reactive mutation or transport semantics.

## Plugins and persistence

Register initialization-only plugins through `plugins?: readonly PiniaPlugin[]`, before Stores are created. For small preferences already reflected in server HTML, use the explicit [Next.js Cookie persistence adapter](../plugins/persistedstate/nextjs): await request cookies in the Server Layout, transfer only allowlisted preference values, and create the Cookie plugin in a Client Provider. Both sides restore the same captured request snapshot; browser commits save Cookies, while server rendering never writes response cookies.

The default localStorage plugin remains a browser-SPA integration; registering it on an SSR tree is not supported. Core Provider code does not read storage or choose business-data priorities. The Cookie adapter merges its selected fields after initialStores. Navigation and router.refresh() retain an existing Provider rather than replaying request data.
