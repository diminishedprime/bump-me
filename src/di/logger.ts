import { inject, Lifecycle, scoped } from "tsyringe";
import { type LogChannel, Vscode } from "#src/vscode";

@scoped(Lifecycle.ContainerScoped)
export class Logger {
  private readonly channel: LogChannel;

  constructor(@inject(Vscode) vscode: Vscode) {
    this.channel = vscode.window.createOutputChannel("Bump Me", {
      log: true,
    });
  }

  trace(message: string, ...values: object[]) {
    this.channel.trace(message, ...values);
  }

  debug(message: string, ...values: unknown[]) {
    this.channel.debug(message, ...values);
  }

  info(message: string, ...values: object[]) {
    this.channel.info(message, ...values);
  }

  warn(message: string, ...values: object[]) {
    this.channel.warn(message, ...values);
  }

  error(message: string, error: unknown) {
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    this.channel.error(`${message}: ${detail}`);
  }

  dispose() {
    this.channel.dispose();
  }
}
