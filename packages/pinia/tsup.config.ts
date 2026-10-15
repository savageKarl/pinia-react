import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/next.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  external: ['immer', 'react', 'react-dom', 'pinia-react'],
  banner: { js: '"use client";' }
})
