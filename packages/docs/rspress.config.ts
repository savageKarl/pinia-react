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
      description: 'Static Site Generator'
    }
    // {
    //   lang: 'zh',
    //   label: '简体中文',
    //   title: 'Pinia-React',
    //   description: '静态网站生成器'
    // }
  ],
  themeConfig: {
    locales: [
      {
        lang: 'en',
        outlineTitle: 'ON THIS Page',
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
