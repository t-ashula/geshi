import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
        projectService: {
          allowDefaultProject: [
            "packages/crawler/test/*.ts",
            "packages/logger/test/*.ts",
            "packages/model/test/*.ts",
            "packages/scribe-client/test/*.ts",
            "packages/model/prisma.config.ts",
          ],
        },
      },
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
        typescript: {
          project: ["./tsconfig.json", "./packages/*/tsconfig.json"],
        },
      },
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "import/no-unresolved": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];
