// Flat ESLint config for Astro + React + TypeScript (ESLint 10).
//
// eslint-plugin-react and eslint-plugin-jsx-a11y have no ESLint 10 release.
// The a11y rules come from eslint-plugin-jsx-a11y-x, the maintained fork that
// eslint-plugin-astro 3 also builds on; the React rules that matter here are
// the Hooks and React Compiler ones, which eslint-plugin-react-hooks carries.
// `bun run health` adds oxlint, which covers jsx-key and friends.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import astroPlugin from 'eslint-plugin-astro';

const tsRules = {
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  '@typescript-eslint/consistent-type-imports': 'warn',
};

export default [
  { ignores: ['dist/**', 'node_modules/**', '.astro/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    ...js.configs.recommended,
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'jsx-a11y-x': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...tsRules,
    },
  },
  ...astroPlugin.configs.recommended,
  {
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.astro'] },
    },
  },
];
