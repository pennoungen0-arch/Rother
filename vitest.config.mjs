import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/.next/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "e2e/**",
      "rother02-archive/**",
    ],
  },
});
