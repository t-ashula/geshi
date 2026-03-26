import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unicorn from "eslint-plugin-unicorn";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";
import vueParser from "vue-eslint-parser";

const commonTypeScriptRules = {
  "no-cond-assign": ["error", "always"],
  "no-console": "error",
  curly: ["error", "all"],
  "@typescript-eslint/no-unused-vars": [
    "error",
    { args: "all", argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "separate-type-imports" },
  ],
  "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
  "simple-import-sort/imports": "error",
  "simple-import-sort/exports": "error",
  "perfectionist/sort-modules": "error",
};

const commonSettings = {
  "import/resolver": {
    typescript: {
      project: [
        "./frontend/tsconfig.json",
        "./backend/tsconfig.json",
        "./cli/tsconfig.json",
      ],
    },
  },
};

const commonPlugins = {
  import: importPlugin,
  perfectionist,
  "simple-import-sort": simpleImportSort,
  unicorn,
};

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["frontend/**/*.ts", "backend/**/*.ts", "cli/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: commonPlugins,
    settings: commonSettings,
    rules: {
      ...commonTypeScriptRules,
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
    },
  },
  {
    files: ["frontend/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: commonPlugins,
    settings: commonSettings,
    rules: {
      ...commonTypeScriptRules,
      "unicorn/filename-case": "off",
    },
  },
  {
    files: ["backend/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/bullmq/*.js", "!**/bullmq/index.js"],
              message: "bullmq imports must go through bullmq/index.js",
            },
            {
              group: ["**/routes/*.js", "!**/routes/index.js"],
              message: "route imports must go through routes/index.js",
            },
            {
              group: ["**/job/*.js", "!**/job/index.js"],
              message: "job imports must go through job/index.js",
            },
          ],
        },
      ],
    },
  },
);
