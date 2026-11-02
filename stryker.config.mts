import type { PartialStrykerOptions } from "@stryker-mutator/api/core";
import { coverage } from "./vitest.config.mts";

export default {
  plugins: [
    "@stryker-mutator/vitest-runner",
    "./scripts/stryker-ignore-logging.mts",
  ],
  ignorers: ["logging"],
  testRunner: "vitest",
  mutate: [
    ...coverage.include,
    ...coverage.exclude.map((pattern) => `!${pattern}`),
  ],
} satisfies PartialStrykerOptions;
