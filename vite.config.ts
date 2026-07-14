import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 550,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
