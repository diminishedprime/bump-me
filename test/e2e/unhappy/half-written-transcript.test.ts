import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

class StillWritingAnAiTitle extends FakeFs {
  override async *lines(path: string) {
    yield* super.lines(path);
    yield '{"type":"ai-title","aiTi';
  }
}

describe("in a session whose transcript ends in a half-written line", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused" } },
      { disk: StillWritingAnAiTitle },
    );
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("uses the last complete title", async () => {
      await expect(harness.macos.notifications).showing({
        title: "Remove the capture file",
      });
    });
  });
});

describe("in an untitled session whose transcript ends in a half-written line", () => {
  let harness: TestHarness<"dotfiles">;

  beforeEach(async () => {
    harness = await freshHarness(
      { dotfiles: { vscode: "unfocused" } },
      { disk: StillWritingAnAiTitle },
    );
    await harness.dotfiles.oob.claude.submitPrompt();
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.dotfiles.oob.claude.finishedTurn();
    });

    it("falls back to the folder name", async () => {
      await expect(harness.macos.notifications).showing({
        title: "dotfiles",
      });
    });
  });
});
