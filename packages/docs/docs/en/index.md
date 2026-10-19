---
pageType: home

hero:
  name: Pinia-React
  text: |
      Structured
      React State
  tagline:  "Type-safe Stores with State, Getters, and Actions"
  actions:
    - theme: brand
      text: Introduction
      link: /guide/start/introduction
    - theme: alt
      text: Quick Start
      link: /guide/start/getting-started
  image:
    src: /rspress-icon.png
    alt: Logo
features:
  - title: Automatic Path Tracking
    details: Tracks state paths read during committed renders to filter unrelated Store subscription updates; it does not prevent every React render.
    icon: 🔄
  - title: 'React Concurrent Rendering Support'
    details: Connects to React concurrent rendering through `useSyncExternalStore`.
    icon: ⚡️
  - title: Developer Friendly
    details: Optional Redux DevTools integration for inspecting opted-in stores and navigating their state history.
    icon: 🕵️
  - title: TypeScript Friendly
    details: Infers types for State, Getters, and Actions.
    icon: 🔍
  - title: Plugin System
    details: Support extensions like persistence and logging to easily customize Store behavior.
    icon: 🧩
  - title: Modular Design
    details: Inherits Pinia's modular design, allowing you to organize your state into multiple manageable Stores.
    icon: 🛠
---
