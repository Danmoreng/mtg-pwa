import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import pluginTs from '@typescript-eslint/eslint-plugin'
import parserTs from '@typescript-eslint/parser'
import parserVue from 'vue-eslint-parser'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/node_modules/**', '**/dev-dist/**', '**/docs/**', 'src/test/**'],
  },
  js.configs.recommended,
  ...pluginTs.configs['flat/recommended'],
  ...pluginVue.configs['flat/recommended'],
  {
    name: 'app/vue-ts-parser',
    files: ['**/*.vue'],
    languageOptions: {
      parser: parserVue,
      parserOptions: {
        parser: parserTs,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    name: 'app/project-rules',
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  eslintConfigPrettier,
]
