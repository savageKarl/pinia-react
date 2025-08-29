# pinia-react

[![NPM Version](https://img.shields.io/npm/v/pinia-react)](https://www.npmjs.com/package/pinia-react)
[![License](https://img.shields.io/npm/l/pinia-react)](https://github.com/savageKarl/pinia-react/blob/main/LICENSE)

pinia-react 是一个受 Vue 的 Pinia 启发的 React 状态管理库，基于 Pinia 的核心代码实现，结合 React Hooks 和 `useSyncExternalStore`，提供简洁、响应式、TypeScript 友好的状态管理体验。

查看 [pinia-react 文档](https://savagekarl.github.io/pinia-react) 获取更多详细信息。

## 概览

### 动机
Pinia 是 Vue 生态中广受好评的状态管理库，以其模块化设计和优雅的 API 著称。pinia-react 将 Pinia 的核心理念和部分实现带入 React 生态，结合 React Hooks 和 `useSyncExternalStore`，提供轻量、直观、TypeScript 友好的状态管理方案，特别适合需要响应式状态管理的现代 React 项目。

### 特性
- 🔄 **Pinia 风格的响应式**：基于 Pinia 的响应式核心（Vue3 reactivity），自动追踪状态依赖，仅更新必要组件。
- ⚡️ **React 并发渲染支持**：通过 `useSyncExternalStore`，确保状态更新与 React 18 的并发特性无缝兼容。
- 🛠 **模块化设计**：沿袭 Pinia 的模块化设计，支持构建多个 Store。
- 🔍 **TypeScript 友好**：内置类型推导，无需额外配置即可获得完整的类型安全。
- 🧩 **插件系统**：支持持久化、日志等扩展功能，轻松定制 Store 行为。
- 🔀 **Pinia API 兼容**：沿用 Pinia 的 API 设计，Vue 开发者可快速上手，React 开发者也能轻松适配。

## 快速开始

### 要求
- React 18+
- ES6+

### 安装

```bash
pnpm add pinia-react
```

### 使用示例

```tsx
import { createPinia, defineStore } from 'pinia-react'
import { useEffect } from 'react'

// 初始化 Pinia（与 Pinia 的 API 一致）
const pinia = createPinia();

// 定义 Store（沿用 Pinia 的 defineStore API）
const useCounterStore = defineStore('counter', {
  // 定义初始状态
  state: () => ({
    count: 0,
    name: 'Counter'
  }),
  
  getters: {
    doubleCount() {
      return this.count * 2 // Pinia 风格的 getter
    }
  },
  
  // 定义actions方法
  actions: {
    increment() {
      this.count++
    },
    
    async fetchSomething() {
      // 支持异步操作
      const result = await api.get('/data')
      this.count = result.count
    }
  }
})

// 在组件中使用
function Counter() {
  // 获取store实例
  const store = useCounterStore()
  
  useEffect(() => {
    // 可以调用action方法
    store.fetchSomething()
  }, [])
  
  return (
    <div>
      <h1>{store.name}: {store.count}</h1>
      <p>Double count: {store.doubleCount}</p>
      <button onClick={() => store.increment()}>Increment</button>
    </div>
  )
}
```
更多高级用法（如插件或组件外使用store）请查看[文档](https://savagekarl.github.io/pinia-react)。

## 常见问题
### pinia-react 与 Pinia 的关系是什么？
pinia-react 是 Pinia 的 React 适配版本，基于 Pinia 的部分核心代码实现，并针对 React 生态进行了优化（例如使用 `useSyncExternalStore` 支持 React 18 的并发渲染）。我们严格遵守 Pinia 的 MIT 许可证，并在许可证文件中保留了原作者的版权信息。

### pinia-react 与 Zustand 或 Redux 相比有何优势？
pinia-react 结合了 Pinia 的模块化设计和 React 的 Hooks API，提供更简洁的 API 和 TypeScript 支持，适合需要响应式状态管理的现代 React 项目。

## 致谢
pinia-react 基于 [Pinia](https://github.com/vuejs/pinia) 的部分代码实现，并针对 React 生态进行了适配和优化。我们在遵守 MIT 许可证的前提下，保留了 Pinia 原作者的版权信息，并在此向 Pinia 项目及其作者表示感谢。此外，本项目也参考了 [Zustand](https://github.com/pmndrs/zustand) 的设计理念。

## 许可证
本项目采用 [MIT 许可证](https://github.com/savageKarl/pinia-react/blob/main/LICENSE)。pinia-react 基于 Pinia 的部分代码实现，严格遵守其 MIT 许可证要求，并保留了原作者的版权信息。详情请查看许可证文件。