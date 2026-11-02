import { describe, expect, it } from "vitest";
import { builtInThemes } from "#fixtures/themes/built-in-themes.ts";
import { freshHarness } from "#test/setup/extension";

describe("When using the built-in themes", () => {
  it.each(builtInThemes)(
    "sends a notifications using the %s theme",
    async (theme) => {
      const harness = await freshHarness({
        bumpMe: { vscode: "unfocused", theme },
      });

      await harness.bumpMe.oob.claude.finishedTurn();

      await expect(harness.macos.notifications).showing();
    },
  );
});
