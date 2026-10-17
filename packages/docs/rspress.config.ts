import * as path from 'node:path'
import { defineConfig } from 'rspress/config'

export default defineConfig({
  lang: 'en',
  root: path.join(__dirname, 'docs'),
  title: 'Pinia-React',
  // icon: '/rspress-icon.png',
  // logo: {
  //   light: '/rspress-light-logo.png',
  //   dark: '/rspress-dark-logo.png'
  // },
  locales: [
    {
      lang: 'en',
      label: 'English',
      title: 'Pinia-React',
      description: 'React state management with State, Getters, and Actions'
    },
    {
      lang: 'zh',
      label: '简体中文',
      title: 'Pinia-React',
      description: '通过 State、Getter 和 Action 管理 React 共享状态'
    }
  ],
  themeConfig: {
    locales: [
      {
        lang: 'en',
        outlineTitle: 'On this page',
        label: ''
      },
      {
        lang: 'zh',
        outlineTitle: '大纲',
        label: ''
      }
    ],
    socialLinks: [
      {
        icon: 'github',
        mode: 'link',
        content: 'https://github.com/savageKarl/pinia-react'
      }
    ]
  },
  base: '/pinia-react/',
  builderConfig: {
    output: {
      assetPrefix: '/pinia-react/'
    }
  }
})
