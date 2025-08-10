import { act, renderHook } from '@testing-library/react'
import { defineStore } from '../src/defineStore'

describe('userStore', () => {
  const useUserStore = defineStore('user', {
    state: () => ({
      count: 0
    }),
    actions: {
      increment() {
        this.count++
      }
    }
  })

  it('should increment the count', () => {
    // renderHook 会在一个虚拟组件中调用 useUserStore
    const { result } = renderHook(() => useUserStore())

    // 初始状态断言
    expect(result.current.count).toBe(0)

    // 使用 act 包裹状态更新，确保 React 更新周期完成
    act(() => {
      result.current.increment()
    })

    // 状态更新后断言
    expect(result.current.count).toBe(1)
  })
})
