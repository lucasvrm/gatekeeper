import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const testDbUrl = `file:${resolve(process.cwd(), 'prisma', 'test.db')}`

export default defineConfig({
  poolOptions: {
    forks: {
      minForks: 1,
      maxForks: 1,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts'],
    env: {
      DATABASE_URL: testDbUrl,
    },
    hookTimeout: 120000,
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    maxConcurrency: 1,
    sequence: {
      concurrent: false,
    },
    threads: false,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
})
