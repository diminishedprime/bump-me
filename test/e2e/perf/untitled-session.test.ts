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

describe("in a session where I submitted a prompt Claude hasn't titled", () => {
  let harness: TestHarness<"dotfiles">;

  beforeEach(async () => {
    harness = await freshHarness(
      { dotfiles: { vscode: "unfocused" } },
      { disk: ResumeTranscriptReads },
    );
    await harness.dotfiles.oob.claude.submitPrompt();
  });

  describe("after Claude finishes two turns", () => {
    beforeEach(async () => {
      await harness.dotfiles.oob.claude.finishedTurn();
      await harness.dotfiles.oob.claude.finishedTurn();
    });

    it("sends a notification without rereading the transcript from the start", async () => {
      await expect(harness.macos.notifications).showing({
        title: "dotfiles",
      });
    });
  });

  describe("after Claude finishes a turn, I submit another prompt, and Claude finishes again", () => {
    beforeEach(async () => {
      await harness.dotfiles.oob.claude.finishedTurn();
      await harness.dotfiles.oob.claude.submitPrompt();
      await harness.dotfiles.oob.claude.finishedTurn();
    });

    it("sends a notification without rereading the transcript from the start", async () => {
      await expect(harness.macos.notifications).showing({
        title: "dotfiles",
      });
    });
  });
});
