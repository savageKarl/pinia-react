---
pageType: home

hero:
  name: Pinia-React
  text: |
      结构化
      React 状态
  tagline:  "通过 State、Getter 和 Action 构建类型安全 Store"
  actions:
    - theme: brand
      text: 介绍
      link: /guide/start/introduction
    - theme: alt
      text: 快速开始
      link: /guide/start/getting-started
  image:
    src: /rspress-icon.png
    alt: Logo
features:
  - title: 自动路径追踪
    details: 追踪已提交渲染读取的状态路径，以过滤无关的 Store 订阅更新；它不会阻止所有 React 渲染。
    icon: 🔄
  - title: '支持 React 并发渲染'
    details: 通过 `useSyncExternalStore` 接入 React 的并发渲染。
    icon: ⚡️
  - title: 开发者友好
    details: 可选的 Redux DevTools 集成，用于检查显式启用的 Store 并浏览其状态历史。
    icon: 🕵️
  - title: TypeScript 友好
    details: 支持 State、Getter 和 Action 的类型推导。
    icon: 🔍
  - title: 插件系统
    details: 支持持久化和日志记录等扩展，轻松定制 Store 行为。
    icon: 🧩
  - title: 模块化设计
    details: 继承 Pinia 的模块化设计，允许你将状态组织成多个易于管理的 Store。
    icon: 🛠
---
