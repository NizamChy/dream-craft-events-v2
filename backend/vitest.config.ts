import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: { NODE_ENV: "test" },
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
