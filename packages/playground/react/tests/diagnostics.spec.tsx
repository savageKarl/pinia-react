import { fireEvent, render, screen } from '@testing-library/react'
import { createPinia, disposePinia, PiniaProvider } from 'pinia-react'
import { createDiagnosticStores, DiagnosticsDemo } from '../src/DiagnosticsDemo'

it('demonstrates notifications separately from parent commits and removes its debug listener on unmount', async () => {
  const pinia = createPinia()
  const stores = createDiagnosticStores(pinia)
  const log = vi.spyOn(console, 'debug').mockImplementation(() => {})
  try {
    const view = render(
      <PiniaProvider pinia={pinia}>
        <DiagnosticsDemo pinia={pinia} stores={stores} />
      </PiniaProvider>
    )
    await screen.findByRole('status')
    log.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Change unread field' }))
    expect(log.mock.calls.filter(([kind, event]) => kind === 'store-debug' && event.type === 'notify')).toHaveLength(0)
    expect(log.mock.calls.filter(([kind, event]) => kind === 'store-debug' && event.type === 'mutation')).toHaveLength(
      1
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change parent prop' }))
    expect(log.mock.calls.some(([kind]) => kind === 'react-commit')).toBe(true)
    expect(log.mock.calls.filter(([kind, event]) => kind === 'store-debug' && event.type === 'notify')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Increment count' }))
    expect(screen.getByRole('status')).toHaveTextContent('total 2')
    expect(log.mock.calls.filter(([kind, event]) => kind === 'store-debug' && event.type === 'notify')).toHaveLength(1)
    log.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Change cross-Store rate' }))
    expect(screen.getByRole('status')).toHaveTextContent('total 3')
    expect(
      log.mock.calls.find(([kind, event]) => kind === 'store-debug' && event.type === 'notify')?.[1]
    ).toMatchObject({
      mutation: { storeId: 'diagnostic-rate' },
      via: [{ storeId: 'diagnostic-reader', getters: ['total'] }]
    })
    const store = stores.getDiagnosticStore(pinia)
    view.unmount()
    log.mockClear()
    store.increment()
    expect(log).not.toHaveBeenCalled()
  } finally {
    disposePinia(pinia)
    log.mockRestore()
  }
})

it('keeps diagnostic getter dependencies on the explicit instance', () => {
  const first = createPinia()
  const a = createDiagnosticStores(first)
  const second = createPinia()
  const b = createDiagnosticStores(second)
  try {
    b.getRate(second).increment()
    a.getDiagnosticStore(first).increment()
    expect(a.getDiagnosticStore(first).total).toBe(2)
    expect(b.getDiagnosticStore(second).total).toBe(0)
  } finally {
    disposePinia(first)
    disposePinia(second)
  }
})
