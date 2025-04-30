module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  env: {
    node: true,
    browser: true,
    es6: true,
  },
  rules: {
    "no-console": "error",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "import/no-unresolved": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_"
      }
    ]

  },
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
      typescript: {
        project: ["./tsconfig.json"]
      }
    },
  },
  overrides: [
    {
      files: ["**/*.test.ts", "**/*.test.tsx"],
      env: {
        jest: true,
      },
    },
    {
      files: ["crawler/src/**/*.ts", "model/src/**/*.ts", "logger/src/**/*.ts", "ui/src/**/*.ts"],
      parserOptions: {
        project: [
          "./tsconfig.json",
          "./crawler/tsconfig.json",
          "./model/tsconfig.json",
          "./logger/tsconfig.json",
          "./ui/tsconfig.json"
        ]
      }
    }
  ],
};