module.exports = {
  root: true,
  extends: [
    '@side/base',
    '@side/prettier',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:jsdoc/recommended',
  ],
  parser: '@typescript-eslint/parser',
  // TODO: Move settings to lint-config base
  settings: {
    'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
    'import/resolver': {
      node: {
        extensions: ['.js', '.json', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    'jsdoc/require-returns-type': 0,
    'jsdoc/require-param-type': 0,
    quotes: ['error', 'single', { avoidEscape: true }],
    // Override airbnb extensions settings
    // TODO: Move this to lint-config base
    // Ensure consistent use of file extension within the import path
    // https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/extensions.md
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        mjs: 'never',
        jsx: 'never',
        ts: 'never',
        tsx: 'never',
      },
    ],
  },
  overrides: [],
};
