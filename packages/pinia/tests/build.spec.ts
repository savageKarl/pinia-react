// @vitest-environment node

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
