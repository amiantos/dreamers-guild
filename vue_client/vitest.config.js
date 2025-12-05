import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/api/demo/__tests__/helpers/setup.js'],
    include: ['src/api/demo/__tests__/**/*.test.js'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/api/demo/**/*.js'],
      exclude: ['src/api/demo/__tests__/**'],
    },
  },
})
