import eslint from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import prettier from '@vue/eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
  },
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        crypto: 'readonly',
        structuredClone: 'readonly',
        confirm: 'readonly',
        document: 'readonly',
        Event: 'readonly',
        HTMLElement: 'readonly',
        HTMLSelectElement: 'readonly',
        MouseEvent: 'readonly',
        Node: 'readonly',
      },
    },
  },
  {
    files: ['src/**/__tests__/*', 'tests/**/*'],
    plugins: { vitest },
    rules: { ...vitest.configs.recommended.rules },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
)
