import { beforeEach, describe, expect, it } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("with themed windows", () => {
  let harness: TestHarness<"bumpMe">;

  describe("when vscode started unfocused in a dark theme", () => {
    beforeEach(async () => {
      harness = await freshHarness({
        bumpMe: { vscode: "unfocused", theme: "Fake Dark" },
      });
    });

    describe("after Claude finishes its turn", () => {
      beforeEach(async () => {
        await harness.bumpMe.oob.claude.finishedTurn();
      });

      it("draws the identicon in the theme's colors", async () => {
        await expect(harness.macos.notifications).showing({
          imageColors: ["#111111", "#FF5555", "#55FF55", "#5555FF"],
          imageWithoutColors: ["#888888", "#550000", "#FFFF55"],
        });
      });

      describe("after I change the theme", () => {
        beforeEach(() => {
          harness.bumpMe.oob.vscode.changeTheme("Fake Light");
        });

        describe("and after Claude finishes another turn", () => {
          beforeEach(async () => {
            await harness.bumpMe.oob.claude.finishedTurn();
          });

          it("redraws the identicon in the new theme's colors", async () => {
            await expect(harness.macos.notifications).showing({
              imageColors: ["#EEEEEE", "#AA0000", "#008800", "#0000AA"],
            });
          });
        });
      });
    });
  });

  describe("when vscode started unfocused in a theme that includes another", () => {
    beforeEach(async () => {
      harness = await freshHarness({
        bumpMe: { vscode: "unfocused", theme: "Fake Include" },
      });
    });

    describe("after Claude finishes its turn", () => {
      beforeEach(async () => {
        await harness.bumpMe.oob.claude.finishedTurn();
      });

      it("draws the identicon in its own background with the included theme's token colors", async () => {
        await expect(harness.macos.notifications).showing({
          imageColors: ["#303030", "#FF8800", "#00CC66", "#6688FF"],
          imageWithoutColors: ["#202020"],
        });
      });
    });
  });
});
