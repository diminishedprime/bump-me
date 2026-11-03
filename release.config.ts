import { readFileSync } from "node:fs";
import type { Options } from "semantic-release";

const commitPartial = readFileSync(
  new URL("scripts/changelog-commit.hbs", import.meta.url),
  "utf8",
);

export default {
  branches: ["main"],
  tagFormat: "main/v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        linkReferences: false,
        linkCompare: false,
        writerOpts: { commitPartial },
      },
    ],
    "@semantic-release/changelog",
    ["@semantic-release/npm", { npmPublish: false }],
    [
      "@semantic-release/exec",
      { prepareCmd: "pnpm exec prettier --write CHANGELOG.md" },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message: "chore: release ${nextRelease.version}",
      },
    ],
    "./scripts/release.mts",
  ],
} satisfies Options;
