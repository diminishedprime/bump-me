import type { Config } from "prettier";

export default {
  overrides: [
    {
      files: ["test/fixtures/hooks/**/*.json"],
      options: {
        plugins: ["prettier-plugin-sort-json"],
        jsonRecursiveSort: true,
      },
    },
    {
      files: ["scripts/release.mts"],
      options: { printWidth: 100 },
    },
  ],
} satisfies Config;
