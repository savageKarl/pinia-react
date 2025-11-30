'use client'

import { defineStore } from 'pinia-react'
import React, { useEffect, useState } from 'react'

export const { useStore } = defineStore('main', {
  state: () => ({
    count: 0,
    user: { name: 'Developer', level: 1 }
  }),
  getters: {
    double(state) {
      return state.count * 2
    },
    doublePlusOne(): number {
      return this.double + 1
    },
    message(state) {
      return `User ${state.user.name} has count ${state.count}`
    }
  },
  actions: {
    increment() {
      this.count++
    },
    incrementBy(amount: number) {
      this.count += amount
    },
    changeName(name: string) {
      this.user.name = name
    },
    fullReplace() {
      this.$patch((state) => {
        Object.assign(state, {
          count: 999,
          user: { name: 'Admin', level: 99 }
        })
      })
    }
  }
})

const DemoComponent = () => {
  const store = useStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  React.useEffect(() => {
    const unsubscribe = store.$subscribe((state, prevState) => {
      console.log(`[App.$subscribe] State changed. Prev count: ${prevState.count}, New count: ${state.count}`)
    })
    return unsubscribe
  }, [store])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '1rem 2rem' }}>
      <h1>pinia-react Showcase</h1>

      <div className='card'>
        <h2>Core State & Getters</h2>
        <p>Count: {store.count}</p>
        <p>User Name: {store.user.name}</p>
        <p>Double: {store.double}</p>
        <p>Double + 1: {store.doublePlusOne}</p>
        <p>Message: {store.message}</p>
      </div>

      <div className='card'>
        <h2>Actions Demo</h2>
        <div className='button-group'>
          <button onClick={() => store.increment()}>this.count++</button>
          <button onClick={() => store.incrementBy(5)}>Increment by 5</button>
          <button onClick={() => store.changeName('Expert')}>this.user.name = 'Expert'</button>
        </div>
      </div>

      <div className='card'>
        <h2>Advanced APIs</h2>
        <div className='button-group'>
          <button onClick={() => store.$reset()}>$reset()</button>
          <button onClick={() => store.fullReplace()}>$patch() with full replace</button>
        </div>
        <details>
          <summary>Current Full State (from $state)</summary>
          <pre>{JSON.stringify(store.$state, null, 2)}</pre>
        </details>
      </div>

      <div className='card'>
        <h2>Plugin Demo (localStorage Persistence)</h2>
        {isMounted ? (
          <>
            <p>
              Is State Persisted in localStorage? <strong>{store.$isPersisted.toString()}</strong>
            </p>
            <div className='button-group'>
              <button onClick={() => store.save()}>Manual Save</button>
              <button onClick={() => store.clearPersistence()}>Clear From Storage</button>
            </div>
          </>
        ) : (
          <p>Checking persistence status...</p>
        )}
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          (Note: State also saves automatically on any change. Try refreshing the page.)
        </p>
      </div>
    </div>
  )
}

export function App() {
  return <DemoComponent />
}
