import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";
import { FakeFs } from "#test/setup/fakes/fs";

let reading: PromiseWithResolvers<void>;
let released: PromiseWithResolvers<void>;

class HeldTranscripts extends FakeFs {
  override async *lines(path: string) {
    reading.resolve();
    await released.promise;
    yield* super.lines(path);
  }
}

describe("when I refocus while the notification is still being prepared", () => {
  let harness: TestHarness<"bumpMe">;

  beforeEach(async () => {
    reading = Promise.withResolvers();
    released = Promise.withResolvers();
    harness = await freshHarness(
      { bumpMe: { vscode: "unfocused" } },
      { disk: HeldTranscripts },
    );
  });

  it("never shows it", async () => {
    const finishing = harness.bumpMe.oob.claude.finishedTurn();
    await reading.promise;
    const refocusing = harness.bumpMe.oob.vscode.focus();
    released.resolve();
    await Promise.all([refocusing, finishing]);

    await expect(harness.macos.notifications).not.showing();
  });
});
