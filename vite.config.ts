import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    dedupe: ["three"],
  },
  build: {
    chunkSizeWarningLimit: 550,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
