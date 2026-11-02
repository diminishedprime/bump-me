import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("in a session Claude titled", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness({ bumpMe: { vscode: "unfocused" } });
  });

  describe("after I retitle it and Claude finishes its turn", () => {
    beforeEach(async () => {
      harness.bumpMe.oob.claude.retitle("Custom title for bump-me");
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("uses my title over Claude's", async () => {
      await expect(harness.macos.notifications).showing({
        title: "Custom title for bump-me",
      });
    });
  });
});

describe("in a session Claude hasn't titled", () => {
  let harness: TestHarness<"dotfiles">;

  beforeEach(async () => {
    harness = await freshHarness({ dotfiles: { vscode: "unfocused" } });
  });

  describe("after I retitle it and Claude finishes its turn", () => {
    beforeEach(async () => {
      harness.dotfiles.oob.claude.retitle("Disk space alert");
      await harness.dotfiles.oob.claude.finishedTurn();
    });

    it("uses my title as the title", async () => {
      await expect(harness.macos.notifications).showing({
        title: "Disk space alert",
      });
    });
  });
});
