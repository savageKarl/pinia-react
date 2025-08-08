import { safeHookRun, safeRun } from '../src/apiEnv'

describe('api env', () => {
  it('should run else callback with safeHookRun', () => {
    const fn = vi.fn()
    const elseFn = vi.fn()
    safeHookRun(fn, elseFn)

    expect(fn).not.toHaveBeenCalled()
    expect(elseFn).toHaveBeenCalledTimes(1)
  })

  it('should run with no errro throw in safeRun', () => {
    const fn = vi.fn()
    const temp = function () {
      // @ts-ignore
      abc()
    }
    expect(temp).toThrowError()

    safeRun(fn)
    expect(fn).toHaveBeenCalled()
  })
})
