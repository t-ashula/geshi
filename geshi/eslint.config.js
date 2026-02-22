const tseslint = require("typescript-eslint");
const importPlugin = require("eslint-plugin-import");

module.exports = [
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
        tsconfigRootDir: __dirname,
        projectService: {
          allowDefaultProject: [
            "crawler/test/*.ts",
            "logger/test/*.ts",
            "model/test/*.ts",
            "scribe/test/*.ts",
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
          project: ["./tsconfig.json", "./*/tsconfig.json"],
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
