import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

class UnreadableTranscripts extends FakeFs {
  override lines(path: string): AsyncGenerator<string> {
    throw new Error(`read the transcript at ${path}`);
  }
}

describe("in a session where I submitted a prompt after retitling it", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused" } },
      { disk: UnreadableTranscripts },
    );
    harness.bumpMe.oob.claude.retitle("Custom title for bump-me");
    await harness.bumpMe.oob.claude.submitPrompt();
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("uses my title without reading the transcript", async () => {
      await expect(harness.macos.notifications).showing({
        title: "Custom title for bump-me",
      });
    });
  });
});
