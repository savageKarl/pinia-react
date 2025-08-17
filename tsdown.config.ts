import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['./src/index.ts'],
    platform: 'browser',
    dts: true,
    noExternal: ['@maoism/runtime-core', 'savage-types', 'savage-utils'],
    minify: true
  }
])
