import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Integration tests talk to the live DB — allow up to 2 minutes per test
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Load env from .env.development.local (Next.js project env file)
    env: { NODE_ENV: 'test' },
    setupFiles: [],
    // Vitest's own env loader (uses dotenv under the hood)
    environmentOptions: {},
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
