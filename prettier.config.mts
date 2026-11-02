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
  ],
} satisfies Config;
