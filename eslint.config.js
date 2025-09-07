import pluginVue from 'eslint-plugin-vue'
import pluginTs from '@typescript-eslint/eslint-plugin'
import parserTs from '@typescript-eslint/parser'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parser: parserTs,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        browser: true,
        es2021: true,
        node: true
      }
    },
    plugins: {
      '@typescript-eslint': pluginTs,
      vue: pluginVue
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:vue/vue3-recommended',
      'prettier'
    ],
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/node_modules/**', '**/dev-dist/**', '**/docs/**']
  }
]