import globals from 'globals';

/**
 * Server lint config. Deliberately narrow: this is a large existing codebase, so
 * the rules here are the ones that catch real defects (undefined variables,
 * unreachable code, bad regexes), not style. `npm run lint` used to run the
 * smoke test rather than a linter, which meant it reported success without ever
 * looking at the source.
 */
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-invalid-regexp': 'error',
      'no-unsafe-negation': 'error',
      'no-cond-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-self-assign': 'error',
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['node_modules/**', 'uploads/**', 'logs/**', 'backups/**'] },
];
