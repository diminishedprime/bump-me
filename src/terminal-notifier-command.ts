import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface Notification {
  group: string;
  title: string;
  subtitle: string;
  message: string;
  execute: string;
  imagePath: string;
}

export interface Posted extends AsyncDisposable {
  closed: Promise<unknown>;
}

export class TerminalNotifierCommand {
  static readonly BINARY = join(
    homedir(),
    "Applications",
    "Bump Me.app",
    "Contents",
    "MacOS",
    "terminal-notifier",
  );

  async post(notification: Notification): Promise<Posted> {
    const child = spawn(TerminalNotifierCommand.BINARY, [
      "-title",
      TerminalNotifierCommand.escaped(notification.title),
      "-subtitle",
      TerminalNotifierCommand.escaped(notification.subtitle),
      "-message",
      TerminalNotifierCommand.escaped(notification.message),
      "-group",
      TerminalNotifierCommand.escaped(notification.group),
      "-action",
      "Dismiss",
      "-execute",
      TerminalNotifierCommand.escaped(notification.execute),
      "-contentImage",
      TerminalNotifierCommand.escaped(notification.imagePath),
    ]);
    await once(child, "spawn");
    const closed = once(child, "close");
    return {
      closed,
      [Symbol.asyncDispose]: async () => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill();
        }
        await closed;
        await run(TerminalNotifierCommand.BINARY, [
          "-remove",
          TerminalNotifierCommand.escaped(notification.group),
        ]);
      },
    };
  }

  private static escaped(value: string) {
    return `\\${value}`;
  }
}
