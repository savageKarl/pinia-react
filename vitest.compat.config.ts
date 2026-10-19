import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// An isolated install can supply another React version without editing the workspace or dependency cache.
const require = createRequire(resolve(process.env.PINIA_COMPAT_MODULES || 'node_modules', '../package.json'))
const react = dirname(require.resolve('react/package.json')).replaceAll('\\', '/')
const reactDOM = dirname(require.resolve('react-dom/package.json')).replaceAll('\\', '/')
const testingLibrary = require.resolve('@testing-library/react').replaceAll('\\', '/')
const requireCore = createRequire(resolve('packages/pinia/package.json'))
const source = resolve(process.env.PINIA_SOURCE_ROOT || 'packages/pinia/src')

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      { find: /^react(?=\/|$)/, replacement: react },
      { find: /^react-dom(?=\/|$)/, replacement: reactDOM },
      { find: '@testing-library/react', replacement: testingLibrary },
      { find: /^pinia-react$/, replacement: resolve(source, 'index.ts') },
      { find: 'immer', replacement: requireCore.resolve('immer') }
    ]
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: fileURLToPath(new URL('./vitest.setup.ts', import.meta.url)),
    include: ['packages/pinia/tests/**/*.spec.{ts,tsx}', 'packages/playground/react/tests/tracking.spec.tsx'],
    server: { deps: { inline: [/zustand/] } }
  }
})
