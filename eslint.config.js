import js from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', '.github/prompts/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      eqeqeq: 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        URL: 'readonly',
      },
    },
  },
];
