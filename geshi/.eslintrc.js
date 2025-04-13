module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'import',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
    ],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
    },
    env: {
        node: true,
        browser: true,
        es6: true,
    },
    rules: {
        'no-console': 'warn',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'import/no-unresolved': 'error',
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
            },
        },
    },
    overrides: [
        {
            files: ['**/*.test.ts', '**/*.test.tsx'],
            env: {
                jest: true,
            },
        },
        {
            files: ['**/ui/**/*.ts', '**/ui/**/*.tsx'],
            extends: [
                'plugin:react/recommended',
                'plugin:react-hooks/recommended',
            ],
            rules: {
                'react/prop-types': 'off',
                'react/react-in-jsx-scope': 'off',
            },
            settings: {
                react: {
                    version: 'detect',
                },
            },
        },
    ],
};