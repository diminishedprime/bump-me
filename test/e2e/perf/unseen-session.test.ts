import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

class ResumeTranscriptReads extends FakeFs {
  private readonly started = new Set<string>();

  override async *lines(path: string, from = 0) {
    if (from === 0 && this.started.has(path)) {
      throw new Error(`reread ${path} from the start`);
    }
    this.started.add(path);
    yield* super.lines(path, from);
  }
}

describe("in a session that started before vscode saw a prompt", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused" } },
      { disk: ResumeTranscriptReads },
    );
  });

  describe("after Claude finishes two turns", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.claude.finishedTurn();
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("uses Claude's title without rereading the transcript from the start", async () => {
      await expect(harness.macos.notifications).showing({
        title: "Remove the capture file",
      });
    });
  });
});
