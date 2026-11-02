import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

class ReadThemeFilesOnce extends FakeFs {
  private readonly read = new Set<string>();

  override async readFile(path: string) {
    if (path.includes("/fixtures/themes/")) {
      if (this.read.has(path)) {
        throw new Error(`read ${path} again`);
      }
      this.read.add(path);
    }
    return super.readFile(path);
  }
}

describe("when vscode started unfocused in a dark theme", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused", theme: "Fake Dark" } },
      { disk: ReadThemeFilesOnce },
    );
  });

  describe("after Claude finishes its turn", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("draws the identicon in the theme's colors reading the theme file once", async () => {
      await expect(harness.macos.notifications).showing({
        imageColors: ["#111111", "#FF5555", "#55FF55", "#5555FF"],
      });
    });
  });
});
