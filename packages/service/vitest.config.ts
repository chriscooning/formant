import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    setupFiles: ["./__tests__/setup.ts"],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.toml",
        },
      },
    },
  },
});
