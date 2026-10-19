import { memo, useRef } from 'react'
import { Example } from '../../shared/playground'
import {
  getComparisonStore,
  resetComparisonZustand,
  type Status,
  useComparisonStore,
  useZustandComparison
} from './comparisonStores'

function useRenderCount() {
  const count = useRef(0)
  count.current++
  return count.current
}

const PiniaCountProbe = memo(function PiniaCountProbe() {
  const store = useComparisonStore()
  return <Probe label='count' value={store.count} renders={useRenderCount()} />
})

const PiniaNameProbe = memo(function PiniaNameProbe() {
  const store = useComparisonStore()
  return <Probe label='name' value={store.name} renders={useRenderCount()} />
})

const ZustandCountProbe = memo(function ZustandCountProbe() {
  const count = useZustandComparison((state) => state.count)
  return <Probe label='count' value={count} renders={useRenderCount()} />
})

const ZustandNameProbe = memo(function ZustandNameProbe() {
  const name = useZustandComparison((state) => state.name)
  return <Probe label='name' value={name} renders={useRenderCount()} />
})

function Probe({ label, value, renders }: { label: string; value: string | number; renders: number }) {
  return (
    <div className='comparison-probe'>
      <div>
        <span className='comparison-label'>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className='render-count'>renders {renders}</span>
    </div>
  )
}

function PiniaPanel() {
  const store = useComparisonStore()
  const cart = useComparisonStore()
  return (
    <div className='comparison-column'>
      <div className='comparison-column-heading'>
        <span className='comparison-badge'>A</span>
        <div>
          <strong>Pinia-React</strong>
          <span>automatic path tracking</span>
        </div>
      </div>
      <div className='comparison-probes'>
        <PiniaCountProbe />
        <PiniaNameProbe />
      </div>
      <div className='comparison-actions'>
        <button className='button-secondary' type='button' onClick={() => getComparisonStore().increment()}>
          Change count
        </button>
      </div>
      <label className='comparison-profile-field'>
        Profile name
        <input
          aria-label='Pinia-React profile name'
          value={store.name}
          onChange={(event) => getComparisonStore().rename(event.currentTarget.value)}
        />
      </label>
      <div className='comparison-cart'>
        <span className='comparison-label'>Cart getter</span>
        <strong>
          {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} · ${cart.total}
        </strong>
        <div className='comparison-actions'>
          <button className='button-text' type='button' onClick={() => getComparisonStore().addItem()}>
            Add item
          </button>
          <button className='button-text' type='button' onClick={() => getComparisonStore().removeItem()}>
            Remove item
          </button>
        </div>
      </div>
      <AsyncStatus status={store.status} message={store.message} onLoad={() => getComparisonStore().load()} />
    </div>
  )
}

function ZustandPanel() {
  const name = useZustandComparison((state) => state.name)
  const itemCount = useZustandComparison((state) => state.items.length)
  const total = useZustandComparison((state) => state.items.reduce((sum, item) => sum + item.price, 0))
  const status = useZustandComparison((state) => state.status)
  const message = useZustandComparison((state) => state.message)
  const increment = useZustandComparison((state) => state.increment)
  const rename = useZustandComparison((state) => state.rename)
  const addItem = useZustandComparison((state) => state.addItem)
  const removeItem = useZustandComparison((state) => state.removeItem)
  const load = useZustandComparison((state) => state.load)
  return (
    <div className='comparison-column'>
      <div className='comparison-column-heading'>
        <span className='comparison-badge comparison-badge-alt'>B</span>
        <div>
          <strong>Zustand</strong>
          <span>explicit selectors</span>
        </div>
      </div>
      <div className='comparison-probes'>
        <ZustandCountProbe />
        <ZustandNameProbe />
      </div>
      <div className='comparison-actions'>
        <button className='button-secondary' type='button' onClick={increment}>
          Change count
        </button>
      </div>
      <label className='comparison-profile-field'>
        Profile name
        <input aria-label='Zustand profile name' value={name} onChange={(event) => rename(event.currentTarget.value)} />
      </label>
      <div className='comparison-cart'>
        <span className='comparison-label'>Selector-derived total</span>
        <strong>
          {itemCount} item{itemCount === 1 ? '' : 's'} · ${total}
        </strong>
        <div className='comparison-actions'>
          <button className='button-text' type='button' onClick={addItem}>
            Add item
          </button>
          <button className='button-text' type='button' onClick={removeItem}>
            Remove item
          </button>
        </div>
      </div>
      <AsyncStatus status={status} message={message} onLoad={load} />
    </div>
  )
}

function AsyncStatus({ status, message, onLoad }: { status: Status; message: string; onLoad: () => void }) {
  return (
    <div className='comparison-async'>
      <span className='comparison-label'>Async workflow</span>
      <strong>{message}</strong>
      <button className='button-primary' type='button' onClick={onLoad} disabled={status === 'loading'}>
        {status === 'loading' ? 'Loading...' : 'Load profile'}
      </button>
    </div>
  )
}

const comparisonCode = `// Pinia-React: state, getters and actions have explicit roles
defineStore('cart', {
  state: () => ({ count: 0, items: [] }),
  getters: {
    total: (state) => state.items.reduce((sum, item) => sum + item.price, 0)
  },
  actions: {
    addItem() {
      this.items.push(item)
    }
  }
})

// Zustand: selectors make each component's dependency explicit
const useCart = create((set) => ({
  count: 0,
  items: [],
  addItem: () => set((state) => ({
    items: [...state.items, item]
  }))
}))

const total = useCart((state) =>
  state.items.reduce((sum, item) => sum + item.price, 0)
)`

export function ComparisonDemo() {
  return (
    <Example
      number='04'
      title='The same workflow, different trade-offs.'
      description='Run the same updates in both stores. Render counters make the subscription boundary visible; the cart and async flow show how each model scales beyond a counter.'
      file='src/ComparisonDemo.tsx'
      code={comparisonCode}
    >
      <div className='comparison-demo'>
        <div className='comparison-intro'>
          <span className='mini-label'>COMPARISON LAB</span>
          <p>
            Change one field, then inspect the render counters. The goal is not to declare a universal winner; it is to
            make the trade-off concrete. This playground uses React Strict Mode, so compare the change after an action
            rather than the initial absolute count.
          </p>
        </div>
        <div className='comparison-grid'>
          <PiniaPanel />
          <ZustandPanel />
        </div>
        <div className='comparison-footer'>
          <button
            className='button-text'
            type='button'
            onClick={() => {
              getComparisonStore().$reset()
              resetComparisonZustand()
            }}
          >
            Reset both implementations
          </button>
          <span>Render counts reset when the page is reloaded.</span>
        </div>
      </div>
    </Example>
  )
}
