// @vitest-environment node

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import config from '../tsup.config'

it('resolves the Next entry self-import to source without existing build output', () => {
  const packageDirectory = fileURLToPath(new URL('../', import.meta.url))
  const distDirectory = fileURLToPath(new URL('../dist/', import.meta.url)).replaceAll('\\', '/')
  const rootDirectory = fileURLToPath(new URL('../../../', import.meta.url))
  const { config: tsconfig } = ts.readConfigFile(
    fileURLToPath(new URL('../../../tsconfig.json', import.meta.url)),
    ts.sys.readFile
  )
  const { options } = ts.parseJsonConfigFileContent(tsconfig, ts.sys, rootDirectory)
  const buildOptions = typeof config === 'object' && !Array.isArray(config) ? config : undefined
  const dtsOptions = typeof buildOptions?.dts === 'object' ? buildOptions.dts : undefined
  const { resolvedModule } = ts.resolveModuleName(
    'pinia-react',
    fileURLToPath(new URL('../src/next.ts', import.meta.url)),
    {
      ...options,
      // Match tsup's declaration-build fallback to the package working directory.
      baseUrl: packageDirectory,
      ...dtsOptions?.compilerOptions
    },
    {
      ...ts.sys,
      fileExists: (fileName) => !fileName.replaceAll('\\', '/').startsWith(distDirectory) && ts.sys.fileExists(fileName)
    }
  )

  expect(resolvedModule?.resolvedFileName.replaceAll('\\', '/')).toBe(
    fileURLToPath(new URL('../src/index.ts', import.meta.url)).replaceAll('\\', '/')
  )
})

it('removes diagnostic allocation and dispatch code from a standard production bundle', async () => {
  const require = createRequire(import.meta.url)
  const requireTsup = createRequire(require.resolve('tsup/package.json'))
  const { build } = requireTsup('esbuild')
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
    bundle: true,
    write: false,
    minify: true,
    platform: 'node',
    format: 'cjs',
    external: ['react', 'react-dom', 'immer'],
    define: { 'process.env.NODE_ENV': '"production"' }
  })
  const output = result.outputFiles[0].text
  expect(output).not.toContain('Store debug listener failed')
  expect(output).not.toContain('Object.freeze')
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', output)(require, compiled, compiled.exports)
  const { createPinia, defineStore, onStoreDebug } = compiled.exports as typeof import('../src')
  const pinia = createPinia()
  const observer = vi.fn()
  const stop = onStoreDebug(pinia, observer)
  const defineSource = defineStore('production-debug', { state: () => ({ count: 0 }) })
  const store = defineSource.getStore(pinia)
  const b = defineStore('production-debug-B', {
    state: () => ({}),
    getters: { value: () => defineSource.getStore().count * 2 }
  })
  const c = defineStore('production-debug-C', { state: () => ({}), getters: { value: () => b.getStore().value + 1 } })
  expect(c.getStore().value).toBe(1)
  store.$patch({ count: 1 })
  expect(store.count).toBe(1)
  expect(c.getStore().value).toBe(3)
  expect(observer).not.toHaveBeenCalled()
  stop()
})

it('keeps ordinary Store mutations usable without a browser process global or an environment define', async () => {
  const require = createRequire(import.meta.url)
  const { build } = createRequire(require.resolve('tsup/package.json'))('esbuild')
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['react', 'react-dom', 'immer']
  })
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', 'process', result.outputFiles[0].text)(
    require,
    compiled,
    compiled.exports,
    undefined
  )
  const { createPinia, defineStore, onStoreDebug } = compiled.exports as typeof import('../src')
  const pinia = createPinia()
  const source = defineStore('no-environment', { state: () => ({ count: 0 }) })
  const store = source.getStore(pinia)
  const b = defineStore('no-environment-B', {
    state: () => ({}),
    getters: { value: () => source.getStore().count * 2 }
  })
  const c = defineStore('no-environment-C', { state: () => ({}), getters: { value: () => b.getStore().value + 1 } })
  expect(c.getStore().value).toBe(1)
  expect(() => store.$patch({ count: 1 })).not.toThrow()
  const observer = vi.fn()
  const stop = onStoreDebug(pinia, observer)
  store.$patch({ count: 2 })
  expect(store.count).toBe(2)
  expect(c.getStore().value).toBe(5)
  expect(observer).not.toHaveBeenCalled()
  stop()
})
