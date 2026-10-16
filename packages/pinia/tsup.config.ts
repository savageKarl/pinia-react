import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/next.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: {
    compilerOptions: {
      paths: {
        'pinia-react': [fileURLToPath(new URL('./src/index.ts', import.meta.url))]
      }
    }
  },
  external: ['immer', 'react', 'react-dom', 'pinia-react'],
  banner: { js: '"use client";' }
})
