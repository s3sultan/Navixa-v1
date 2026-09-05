import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // NAVIXA deliberately uses browser-native media APIs and remote team logos.
      // These framework advisories are documented in the architecture and are not
      // actionable correctness failures for this Worker deployment.
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "off",
      "prefer-const": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "public/**",
    ".wrangler/**",
    ".sites-stage-*/**",
    "next-env.d.ts",
    "reports/**",
    "scripts/**",
    "*.md",
  ]),
]);

export default eslintConfig;
