import { defineConfig } from 'vitest/config'

const runE2E = process.env.VITEST_RUN_E2E === 'true'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    ...(runE2E ? {} : { include: ['test/**/*.spec.ts'] }),
    exclude: runE2E ? [] : ['test/**/*.e2e.spec.ts'],
    env: {
      DATABASE_URL: 'file:./test.db',
    },
    hookTimeout: 120000,
    threads: false,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
})
