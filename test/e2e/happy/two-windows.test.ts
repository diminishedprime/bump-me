import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("with two windows open", () => {
  let harness: TestHarness<"bumpMe" | "mindfulStage">;

  beforeEach(async () => {
    harness = await freshHarness({
      bumpMe: { vscode: "focused" },
      mindfulStage: { vscode: "focused" },
    });
  });

  describe("after I unfocus both", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.vscode.unfocus();
      await harness.mindfulStage.oob.vscode.unfocus();
    });

    describe("after Claude finishes its turn in both", () => {
      beforeEach(async () => {
        await harness.bumpMe.oob.claude.finishedTurn();
        await harness.mindfulStage.oob.claude.finishedTurn();
      });

      it("shows a notification for each window", async () => {
        await expect(harness.macos.notifications).showing({
          title: "Remove the capture file",
        });
        await expect(harness.macos.notifications).showing({
          title: "Tidy up the stage",
        });
      });
    });
  });
});
