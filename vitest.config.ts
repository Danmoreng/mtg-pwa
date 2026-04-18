import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['src/test/**/*.test.ts'],
    
    // run in a single thread to avoid Dexie DB name collisions
    poolOptions: { threads: { singleThread: true } },

    // helpful defaults
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
