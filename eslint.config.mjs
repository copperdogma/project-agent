import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts}"] ,
    languageOptions: {
      parser: tsparser,
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        setTimeout: "readonly",
        Atomics: "readonly",
        SharedArrayBuffer: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  { ignores: ["dist/**", "node_modules/**"] },
];
