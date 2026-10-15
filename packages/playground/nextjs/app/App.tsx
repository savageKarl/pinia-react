'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { defineStore } from 'pinia-react'

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
  const router = useRouter()

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
        <h2>Navigation</h2>
        <p>The root Provider keeps your changes while navigating or refreshing server data.</p>
        <Link href='/details'>Open another page</Link>
        <button onClick={() => router.refresh()}>Refresh server data</button>
      </div>

      <style>{`
        .card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .button-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        button {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: 1px solid #ccc;
          background-color: #f0f0f0;
          cursor: pointer;
          font-size: 1rem;
        }
        button:hover {
          background-color: #e0e0e0;
        }
        pre {
          background-color: #f5f5f5;
          padding: 1rem;
          border-radius: 4px;
          white-space: pre-wrap;
          word-break: break-all;
        }
      `}</style>
    </div>
  )
}

export function App() {
  return <DemoComponent />
}
