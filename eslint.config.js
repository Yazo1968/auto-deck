import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import unicornPlugin from 'eslint-plugin-unicorn';
import sonarjsPlugin from 'eslint-plugin-sonarjs';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      '*.config.js',
      '*.config.ts',
      'reference files (unused)/**',
      'reference md (not used by the app)/**',
      'audit-reports/**',
      '**/*.bak',
      '**/*.backup.*',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript parser config for all TS/TSX files
  ...tseslint.configs.recommended,

  // Main config for all TS/TSX/JS/JSX files
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
      import: importPlugin,
      promise: promisePlugin,
      unicorn: unicornPlugin,
      sonarjs: sonarjsPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    rules: {
      // =============================================
      // ESLint Core Rules
      // =============================================

      // Disable base no-unused-vars in favor of TS version
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unreachable-loop': 'error',
      // Disable base no-use-before-define in favor of TS version
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': ['error', {
        functions: false,
        classes: true,
        variables: true,
        allowNamedExports: true,
      }],

      // -- Suggestions --
      'no-console': 'warn',
      'no-alert': 'warn',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-template': 'warn',
      'no-nested-ternary': 'warn',
      'no-else-return': 'warn',
      'no-lonely-if': 'warn',
      'no-unneeded-ternary': 'warn',
      'prefer-arrow-callback': 'warn',
      'no-param-reassign': ['warn', { props: false }],
      // Disable base no-shadow in favor of TS version
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'warn',
      'curly': ['warn', 'all'],
      'default-case': 'warn',
      'no-magic-numbers': ['warn', {
        ignore: [-1, 0, 1, 2, 100],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        enforceConst: false,
        ignoreClassFieldInitialValues: true,
      }],

      // Relax some typescript-eslint recommended rules for audit context
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',

      // =============================================
      // React Plugin Rules
      // =============================================
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-unused-state': 'warn',
      'react/jsx-no-useless-fragment': 'warn',
      'react/jsx-curly-brace-presence': ['warn', {
        props: 'never',
        children: 'never',
      }],
      'react/self-closing-comp': 'warn',
      'react/no-array-index-key': 'warn',
      'react/no-danger': 'warn',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-pascal-case': 'warn',
      'react/no-unstable-nested-components': 'error',

      // Disable rules that conflict with TS or aren't needed
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // =============================================
      // React Hooks Plugin Rules
      // =============================================
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // =============================================
      // Import Plugin Rules
      // =============================================
      'import/no-duplicates': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': ['warn', { maxDepth: 5 }],
      'import/no-useless-path-segments': 'warn',
      'import/order': ['warn', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'never',
      }],
      'import/newline-after-import': 'warn',
      'import/no-unresolved': 'off', // Vite handles resolution

      // =============================================
      // SonarJS Plugin Rules (Code Smells / Complexity)
      // =============================================
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/no-small-switch': 'warn',
      'sonarjs/prefer-single-boolean-return': 'warn',
      'sonarjs/no-inverted-boolean-check': 'warn',
      'sonarjs/no-nested-switch': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',

      // =============================================
      // Unicorn Plugin Rules (Modern JS Best Practices)
      // =============================================
      'unicorn/no-array-for-each': 'warn',
      'unicorn/prefer-array-find': 'warn',
      'unicorn/prefer-array-flat-map': 'warn',
      'unicorn/prefer-array-some': 'warn',
      'unicorn/prefer-includes': 'warn',
      'unicorn/prefer-string-starts-ends-with': 'warn',
      'unicorn/no-lonely-if': 'warn',
      'unicorn/no-nested-ternary': 'warn',
      'unicorn/prefer-ternary': 'off',
      'unicorn/no-null': 'off', // React uses null
      'unicorn/prevent-abbreviations': 'off', // Too noisy for existing code
      'unicorn/filename-case': 'off', // Audit only, don't enforce

      // =============================================
      // Promise Plugin Rules
      // =============================================
      'promise/catch-or-return': 'warn',
      'promise/no-nesting': 'warn',
      'promise/no-return-wrap': 'error',
      'promise/param-names': 'error',
    },
  },
];
