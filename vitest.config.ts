import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Integration tests talk to the live DB — allow up to 2 minutes per test
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Load env from .env.development.local (Next.js project env file).
    // RUN_LIVE_SUPABASE_TESTS must be explicitly set by the caller — it is never
    // passed from the project env files, so the guard in the test file fires by
    // default unless the caller explicitly adds it.
    env: {
      NODE_ENV: 'test',
      ...(process.env.RUN_LIVE_SUPABASE_TESTS
        ? { RUN_LIVE_SUPABASE_TESTS: process.env.RUN_LIVE_SUPABASE_TESTS }
        : {}),
    },
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
