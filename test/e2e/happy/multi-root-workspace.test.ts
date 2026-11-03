import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("in a multi-root workspace", () => {
  let harness: TestHarness<"multiRoot">;

  beforeEach(async () => {
    harness = await freshHarness({
      multiRoot: { vscode: "unfocused" },
    });
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.multiRoot.oob.claude.finishedTurn();
    });

    it("takes me back to the workspace when I click the notification", async () => {
      await harness.multiRoot.oob.macos.clickNotification();

      expect(harness.code).openedWorkspace(
        "/Users/me/programming/side-projects.code-workspace",
      );
    });
  });
});

describe("in an untitled multi-root workspace", () => {
  let harness: TestHarness<"untitledMultiRoot">;

  beforeEach(async () => {
    harness = await freshHarness({
      untitledMultiRoot: { vscode: "unfocused" },
    });
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.untitledMultiRoot.oob.claude.finishedTurn();
    });

    it("takes me back to the workspace when I click the notification", async () => {
      await harness.untitledMultiRoot.oob.macos.clickNotification();

      expect(harness.code).openedWorkspace(
        "/Users/me/Library/Application Support/Code/Workspaces/1793664027099/workspace.json",
      );
    });
  });
});
