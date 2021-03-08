module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: ['airbnb-base', 'plugin:prettier/recommended', 'prettier'],
  plugins: ['prettier', '@typescript-eslint'],
  settings: {
    'import/resolver': {
      node: {
        moduleDirectory: ['node_modules', '/'],
        extensions: ['.ts', '.jsx', '.js'],
      },
    },
  },
  env: {
    node: true,
  },
  rules: {
    'no-return-await': 2,
    quotes: ['error', 'single', { avoidEscape: true }],
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        trailingComma: 'all',
      },
    ],
  },
  overrides: [],
};
