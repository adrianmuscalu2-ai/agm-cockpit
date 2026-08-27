import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  {
    name: 'agm/api-ignores',
    ignores: ['dist/**'],
  },
  ...tseslint.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
  })),
];
