import eslintConfigPrettier from "eslint-config-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import vue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import vueParser from "vue-eslint-parser";

const typedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: [
    "backend/src/**/*.ts",
    "backend/test/**/*.ts",
    "frontend/src/**/*.ts",
    "frontend/test/**/*.ts",
    "frontend/vite.config.ts",
    "test/**/*.ts",
    "test/playwright.config.ts",
  ],
}));

export default tseslint.config(
  {
    ignores: ["coverage/**", "dist/**", "node_modules/**", "tmp/**"],
  },
  {
    files: [
      "backend/src/**/*.ts",
      "backend/test/**/*.ts",
      "frontend/src/**/*.ts",
      "frontend/test/**/*.ts",
      "frontend/vite.config.ts",
      "test/**/*.ts",
      "test/playwright.config.ts",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      unicorn,
      "simple-import-sort": simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      curly: ["error", "all"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[importKind='value'] > ImportSpecifier[importKind='type']",
          message:
            "Use a separate `import type { ... }` declaration for type-only imports.",
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["frontend/src/**/*.vue"],
    plugins: {
      vue,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        extraFileExtensions: [".vue"],
        parser: tseslint.parser,
        project: "./frontend/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "vue/html-self-closing": "error",
      "vue/multi-word-component-names": "off",
    },
  },
  {
    files: [
      "backend/src/**/*.ts",
      "backend/test/**/*.ts",
      "frontend/src/**/*.ts",
      "frontend/test/**/*.ts",
      "frontend/vite.config.ts",
      "test/**/*.ts",
      "test/playwright.config.ts",
    ],
    plugins: {
      unicorn,
    },
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
    },
  },
  ...typedConfigs,
  eslintConfigPrettier,
);
