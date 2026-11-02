import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

class UnreadableTranscripts extends FakeFs {
  override lines(path: string): AsyncGenerator<string> {
    throw new Error(`EACCES: permission denied, open '${path}'`);
  }
}

describe("in a session whose transcript can't be read", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused" } },
      { disk: UnreadableTranscripts },
    );
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("falls back to the folder name", async () => {
      await expect(harness.macos.notifications).showing({
        title: "bump-me",
      });
    });
  });
});
