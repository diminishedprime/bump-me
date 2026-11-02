import { describe, expect, it } from "vitest";
import { freshHarness } from "#test/setup/extension";

describe("When using a theme Bump Me can't read", () => {
  it.each([
    ["whose tokenColors is a TextMate file", "Fake TextMate"],
    ["whose file is a TextMate XML plist", "Fake XML"],
    ["whose file is missing", "Fake Missing"],
    ["whose extension's manifest is missing its path", "Fake Broken"],
  ] as const)("sends a notification without exploding", async (_, theme) => {
    const harness = await freshHarness({
      bumpMe: { vscode: "unfocused", theme },
    });

    await harness.bumpMe.oob.claude.finishedTurn();

    await expect(harness.macos.notifications).showing();
  });
});
