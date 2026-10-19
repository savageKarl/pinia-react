import { render } from '@testing-library/react'
import { createPinia, defineStore, disposePinia, PiniaProvider } from '../src'

it('rejects reinitializing a supplied Pinia but permits explicitly undefined initialization props', () => {
  const owner = createPinia()
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    expect(() =>
      render(
        <PiniaProvider pinia={owner} plugins={[]}>
          {null}
        </PiniaProvider>
      )
    ).toThrow(/initialStores|plugins/)
    expect(() =>
      render(
        <PiniaProvider pinia={owner} initialStores={{}}>
          {null}
        </PiniaProvider>
      )
    ).toThrow(/initialStores|plugins/)
    const view = render(
      <PiniaProvider pinia={owner} plugins={undefined} initialStores={undefined}>
        {null}
      </PiniaProvider>
    )
    view.unmount()
    expect(defineStore('external', { state: () => ({ count: 1 }) }).getStore(owner).count).toBe(1)
    disposePinia(owner)
    expect(() => render(<PiniaProvider pinia={owner}>{null}</PiniaProvider>)).toThrow(/disposed/)
  } finally {
    error.mockRestore()
    disposePinia(owner)
  }
})
