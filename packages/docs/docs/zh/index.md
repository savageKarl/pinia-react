---
pageType: home

hero:
  name: Pinia-React
  text: |
      符合直觉的
      React 状态管理库
  tagline:  "类型安全、可扩展性以及模块化设计"
  actions:
    - theme: brand
      text: 介绍
      link: guide/start/introduction
    - theme: alt
      text: 快速开始
      link: guide/start/getting-started
  image:
    src: /rspress-icon.png
    alt: Logo
features:
  - title: 'Pinia 风格的响应式'
    details: '基于 Pinia 的响应式核心（Vue3 reactivity），自动追踪状态依赖，仅更新必要组件。'
    icon: 🔄
  - title: 'React 并发渲染支持'
    details: '通过 `useSyncExternalStore`，确保状态更新与 React 18 的并发特性无缝兼容。'
    icon: ⚡️
  - title: '模块化设计'
    details: '沿袭 Pinia 的模块化设计，支持构建多个 Store。'
    icon: 🛠
  - title: 'TypeScript 友好'
    details: '内置类型推导，无需额外配置即可获得完整的类型安全。'
    icon: 🔍
  - title: '插件系统'
    details: '支持持久化、日志等扩展功能，轻松定制 Store 行为。'
    icon: 🧩
  - title: 'Pinia API 兼容'
    details: '沿用 Pinia 的 API 设计，Vue 开发者可快速上手，React 开发者也能轻松适配。'
    icon: 🔀
---