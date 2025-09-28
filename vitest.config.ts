import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/**/*.test.ts'],
    
    // run in a single thread to avoid Dexie DB name collisions
    poolOptions: { threads: { singleThread: true } },

    // helpful defaults
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})