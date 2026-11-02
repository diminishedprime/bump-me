import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

class StopReadingAtTheAiTitle extends FakeFs {
  override async *lines(path: string) {
    for await (const line of super.lines(path)) {
      yield line;
      if (line.includes('"ai-title"')) {
        throw new Error(`read past the ai-title in ${path}`);
      }
    }
  }
}

describe("in a session where I submitted a prompt without retitling it", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused" } },
      { disk: StopReadingAtTheAiTitle },
    );
    await harness.bumpMe.oob.claude.submitPrompt();
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("uses Claude's title without reading past it", async () => {
      await expect(harness.macos.notifications).showing({
        title: "Remove the capture file",
      });
    });
  });
});
