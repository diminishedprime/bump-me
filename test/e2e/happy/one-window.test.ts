import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshHarness, type TestHarness } from "#test/setup/extension";

describe("in a standard session", () => {
  let harness: TestHarness<"bumpMe">;

  describe("when vscode started focused", () => {
    beforeEach(async () => {
      harness = await freshHarness({
        bumpMe: { vscode: "focused" },
      });
    });

    describe("does not send notifications", () => {
      it("when Claude finishes its turn", async () => {
        await harness.bumpMe.oob.claude.finishedTurn();

        await expect(harness.macos.notifications).not.showing();
      });

      it("on a permission request", async () => {
        await harness.bumpMe.oob.claude.permissionRequest(
          "Delete the capture file",
        );

        await expect(harness.macos.notifications).not.showing();
      });
    });

    describe("after I unfocus vscode", () => {
      beforeEach(async () => {
        await harness.bumpMe.oob.vscode.unfocus();
      });

      describe("after I submit a prompt", () => {
        beforeEach(async () => {
          await harness.bumpMe.oob.claude.submitPrompt();
        });

        it("does not send a notification", async () => {
          await expect(harness.macos.notifications).not.showing();
        });
      });

      describe("after Claude finishes its turn", () => {
        beforeEach(async () => {
          await harness.bumpMe.oob.claude.finishedTurn();
        });

        it("sends a notification", async () => {
          await expect(harness.macos.notifications).showing({
            title: "Remove the capture file",
            subtitle: "Finished turn",
            message: "Click to return to VS Code",
          });

          await harness.bumpMe.oob.vscode.idle();

          await expect(harness.macos.notifications).showing();

          await harness.bumpMe.oob.vscode.focus();

          await expect(harness.macos.notifications).not.showing();
        });

        it("reuses the identicon when Claude finishes another turn", async () => {
          vi.useFakeTimers({ toFake: ["Date"] });
          const writtenTime = await harness.disk.identiconsWrittenAt();
          vi.setSystemTime(Date.now() + 60_000);

          await harness.bumpMe.oob.claude.finishedTurn();

          expect(await harness.disk.identiconsWrittenAt()).toEqual(writtenTime);
        });

        it("takes me back to this window when I click the notification", async () => {
          await harness.bumpMe.oob.macos.clickNotification();

          expect(harness.code).openedWorkspace("/Users/me/programming/bump-me");
        });

        describe("and after I close vscode", () => {
          beforeEach(async () => {
            await harness.bumpMe.oob.vscode.close();
          });

          it("withdraws the notification and removes its identicon", async () => {
            await expect(harness.macos.notifications).not.showing();
            await expect(harness.disk).not.holdingIdenticons();
          });
        });
      });

      describe("after Claude asks permission", () => {
        beforeEach(async () => {
          await harness.bumpMe.oob.claude.permissionRequest(
            "Delete the capture file",
          );
        });

        it("sends a permission request notification", async () => {
          await expect(harness.macos.notifications).showing({
            title: "Remove the capture file",
            subtitle: "Permission request",
            message: "Delete the capture file",
          });
        });
      });

      describe("after Claude asks permission to run a command it didn't describe", () => {
        beforeEach(async () => {
          await harness.bumpMe.oob.claude.undescribedPermissionRequest();
        });

        it("names the tool it wants to use", async () => {
          await expect(harness.macos.notifications).showing({
            message: "Claude wants to use Bash",
          });
        });
      });

      describe("after Claude asks permission to use an MCP tool whose description isn't text", () => {
        beforeEach(async () => {
          await harness.bumpMe.oob.claude.mcpPermissionRequest();
        });

        it("names the tool it wants to use", async () => {
          await expect(harness.macos.notifications).showing({
            message: "Claude wants to use mcp__notes__create_note",
          });
        });
      });
    });
  });

  describe("when vscode Insiders started unfocused", () => {
    beforeEach(async () => {
      harness = await freshHarness({
        bumpMe: { vscode: "unfocused", editor: "VS Code Insiders" },
      });
    });

    describe("after Claude finishes its turn", () => {
      beforeEach(async () => {
        await harness.bumpMe.oob.claude.finishedTurn();
      });

      it("takes me back to this window when I click the notification", async () => {
        await harness.bumpMe.oob.macos.clickNotification();

        expect(harness.code).openedWorkspace("/Users/me/programming/bump-me");
      });
    });
  });
});
