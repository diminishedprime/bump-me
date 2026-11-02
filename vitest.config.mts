import { configDefaults, defineConfig } from "vitest/config";

export const coverage = {
  include: ["src/**"],
  exclude: ["src/main.ts", "src/di/logger.ts", "src/**/*.spec.ts"],
};

const timeouts =
  process.env["STRYKER_MUTATOR_WORKER"] === undefined ? {} : { testTimeout: 0 };

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ".stryker-tmp/**"],
    setupFiles: ["test/setup/extension.ts"],
    ...timeouts,
    coverage: {
      provider: "v8",
      ...coverage,
      reporter: ["text", "html"],
    },
  },
});
