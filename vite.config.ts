import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  worker: {
    format: "es",
  },
  resolve: {
    dedupe: ["three"],
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/examples/jsm/")) {
            return "three-addons";
          }
          if (id.includes("/node_modules/three/")) return "three-core";
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
