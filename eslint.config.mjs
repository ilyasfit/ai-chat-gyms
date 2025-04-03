import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Add override for Tailwind config
  {
    files: ["tailwind.config.ts", "postcss.config.mjs"], // Apply to config files
    rules: {
      "@typescript-eslint/no-var-requires": "off", // Allow require in these files
      "import/no-commonjs": "off", // Also allow CommonJS patterns if needed
    },
  },
];

export default eslintConfig;
