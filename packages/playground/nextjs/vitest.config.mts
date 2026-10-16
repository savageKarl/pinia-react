import { defineConfig, mergeConfig } from 'vitest/config'
import base from '../../../vitest.config'

export default mergeConfig(base, defineConfig({ esbuild: { jsx: 'automatic', jsxImportSource: 'react' } }))
