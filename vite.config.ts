import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    {
      name: "markdown-as-text",
      enforce: "pre",
      load(id: string) {
        if (!id.endsWith(".md")) return null;
        return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
      },
    },
  ],
  fmt: { ignorePatterns: ["generated/commons.md", "generated/wire.ts", "frontend/**"] },
  lint: {
    ignorePatterns: ["frontend/**"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",

      "unicorn/no-thenable": "off",
      "typescript/await-thenable": "off",
      "typescript/unbound-method": "off",
      "typescript/restrict-template-expressions": "off",
    },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
  staged: {
    "*.{ts,json,md}": "vp check --fix",
  },
});
