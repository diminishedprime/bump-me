import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("in a session Claude hasn't titled", () => {
  let harness: TestHarness<"dotfiles">;

  beforeEach(async () => {
    harness = await freshHarness({ dotfiles: { vscode: "unfocused" } });
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.dotfiles.oob.claude.finishedTurn();
    });

    it("uses the folder name as the title", async () => {
      await expect(harness.macos.notifications).showing({
        title: "dotfiles",
      });
    });
  });
});
