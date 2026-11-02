import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("in a workspace with zero folders", () => {
  let harness: TestHarness<"emptyWorkspace">;

  beforeEach(async () => {
    harness = await freshHarness({ emptyWorkspace: { vscode: "focused" } });
  });

  describe("after I unfocus vscode", () => {
    beforeEach(async () => {
      await harness.emptyWorkspace.oob.vscode.unfocus();
    });

    describe("after Claude finishes its turn", () => {
      beforeEach(async () => {
        await harness.emptyWorkspace.oob.claude.finishedTurn();
      });

      it("does not send a notification", async () => {
        await expect(harness.macos.notifications).not.showing();
      });
    });
  });
});
