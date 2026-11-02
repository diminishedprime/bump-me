import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("in a window with no workspace", () => {
  let harness: TestHarness<"noWorkspace">;

  beforeEach(async () => {
    harness = await freshHarness({ noWorkspace: { vscode: "focused" } });
  });

  describe("after I unfocus vscode", () => {
    beforeEach(async () => {
      await harness.noWorkspace.oob.vscode.unfocus();
    });

    describe("after Claude finishes its turn", () => {
      beforeEach(async () => {
        await harness.noWorkspace.oob.claude.finishedTurn();
      });

      it("does not send a notification", async () => {
        await expect(harness.macos.notifications).not.showing();
      });
    });
  });
});
