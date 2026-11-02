import { basename } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

class ReadProductJsonOnce extends FakeFs {
  private readProductJson = false;

  override async readFile(path: string) {
    if (basename(path) === "product.json") {
      if (this.readProductJson) {
        throw new Error(`read ${path} again`);
      }
      this.readProductJson = true;
    }
    return super.readFile(path);
  }
}

describe("in a standard session", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused" } },
      { disk: ReadProductJsonOnce },
    );
  });

  describe("after Claude finishes two turns", () => {
    beforeEach(async () => {
      await harness.bumpMe.oob.claude.finishedTurn();
      await harness.bumpMe.oob.claude.finishedTurn();
    });

    it("sends a notification without reading VS Code's product.json again", async () => {
      await expect(harness.macos.notifications).showing();
    });
  });
});
