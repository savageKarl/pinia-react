import react from 'react'
import { type MockInstance, type Mock } from 'vitest'
import { activeEffect } from '@maoism/runtime-core'
import { useRender, setActiveEffect } from '../src/utils'

describe('utils', () => {
  let setState: Mock
  let useStateSpy: MockInstance
  let useCallbackSpy: MockInstance

  beforeEach(() => {
    setState = vi.fn()
    useStateSpy = vi
      .spyOn(react, 'useState')
      // @ts-ignore
      .mockImplementation((state) => [state, setState])

    useCallbackSpy = vi
      .spyOn(react, 'useCallback')
      // @ts-ignore
      .mockImplementation((fn: () => any, dep: any[]) => {
        return fn
      })
  })

  it('useRender', () => {
    const render = useRender()
    expect(useStateSpy).toHaveBeenCalled()
    expect(useStateSpy).toHaveBeenCalledTimes(1)

    expect(useCallbackSpy).toHaveBeenCalled()
    expect(useCallbackSpy).toHaveBeenCalledTimes(1)

    render()
    expect(setState).toHaveBeenCalled()
    expect(setState).toHaveBeenCalledTimes(1)
  })

  it('setActiveEffect', () => {
    expect(activeEffect.value).toBe(undefined)
    setActiveEffect()
    expect(activeEffect.value).toBeTruthy()
  })
})
