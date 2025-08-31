export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,vue}'],
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/node_modules/**']
  }
]