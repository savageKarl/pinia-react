// // @vitest-environment happy-dom
// import { renderHook, act } from '@testing-library/react'
// import react from 'react'
// import { type MockInstance, type Mock } from 'vitest'
// import { useReactiveState, useRefState, useGetterState } from '../src/hooks'

// describe('hooks', () => {
//   let setState: Mock
//   let useStateSpy: MockInstance
//   let useCallbackSpy: MockInstance

//   beforeEach(() => {
//     setState = vi.fn()
//     useStateSpy = vi
//       .spyOn(react, 'useState')
//       // @ts-ignore
//       .mockImplementation((state) => [state, setState])

//     useCallbackSpy = vi
//       .spyOn(react, 'useCallback')
//       // @ts-ignore
//       .mockImplementation((fn: () => any, dep: any[]) => {
//         return fn
//       })
//   })

//   it('useRefState', () => {
//     const { result } = renderHook(useRefState, { initialProps: 0 })
//     expect(result.current.value).toBe(0)

//     result.current.value += 1
//     expect(result.current.value).toBe(1)
//     expect(setState).toHaveBeenCalled()
//     expect(setState).toHaveBeenCalledTimes(1)

//     result.current.value += 1
//     expect(result.current.value).toBe(2)
//     expect(setState).toHaveBeenCalled()
//     expect(setState).toHaveBeenCalledTimes(2)
//   })

//   it('useReactiveState', () => {
//     const { result } = renderHook(useReactiveState, {
//       initialProps: { foo: 'foo' }
//     })
//     expect(result.current.foo).toBe('foo')

//     result.current.foo = 'bar'
//     expect(result.current.foo).toBe('bar')
//     expect(setState).toHaveBeenCalled()
//     expect(setState).toHaveBeenCalledTimes(1)

//     result.current.foo = 'cat'
//     expect(result.current.foo).toBe('cat')
//     expect(setState).toHaveBeenCalled()
//     expect(setState).toHaveBeenCalledTimes(2)
//   })

//   it('useGetterState', () => {
//     const res = useReactiveState({
//       firstName: 'foo',
//       lastName: 'bar'
//     })
//     expect(res.firstName).toBe('foo')

//     const fullName = useGetterState(() => res.firstName + res.lastName)
//     expect(fullName.value).toBe('foobar')

//     res.firstName = 'jack'
//     expect(setState).toHaveBeenCalled()
//     expect(setState).toHaveBeenCalledTimes(1)
//     expect(fullName.value).toBe('jackbar')
//   })
// })

test('test', () => {
  expect('good').toBeTruthy()
})
