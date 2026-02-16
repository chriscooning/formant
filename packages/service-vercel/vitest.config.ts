import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@formant/service": resolve(__dirname, "../service/src/index.ts"),
    },
  },
});
