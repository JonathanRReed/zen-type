// Flat ESLint config for Astro + React + TypeScript
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import astroPlugin from 'eslint-plugin-astro';
import astroParser from 'astro-eslint-parser';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.astro/**', 'src/pages/quote_old_backup.astro'] },
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    ...js.configs.recommended,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        CustomEvent: 'readonly',
        performance: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      // Core plugin baselines
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      // Lightweight TS hygiene without type-checking
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  // Astro files
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        // Use TS parser for embedded scripts in .astro files
        parser: tsparser,
        extraFileExtensions: ['.astro'],
      },
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        CustomEvent: 'readonly',
        performance: 'readonly',
      },
    },
    plugins: { astro: astroPlugin },
    processor: astroPlugin.processors.astro,
    rules: {
      ...astroPlugin.configs.recommended.rules,
      // Inline browser scripts in .astro run in the browser; avoid false positives
      'no-undef': 'off',
    },
  },
  // Virtual script blocks inside .astro files
  {
    files: ['**/*.astro/*.js', '**/*.astro/*.ts'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        CustomEvent: 'readonly',
        performance: 'readonly',
      },
    },
    rules: {
      // Avoid false positives where virtual scripts are evaluated without browser env
      'no-undef': 'off',
    },
  },
];
