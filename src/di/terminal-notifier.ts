import { join } from "node:path";
import { quote } from "shell-quote";
import { inject, injectable } from "tsyringe";
import * as z from "zod/mini";
import { Identicon } from "#src/di/identicon";
import { Logger } from "#src/di/logger";
import { Fs } from "#src/fs";
import { TerminalNotifierCommand } from "#src/terminal-notifier-command";
import { Vscode } from "#src/vscode";

const ProductSchema = z.object({ applicationName: z.string() });

export interface Notification {
  group: string;
  title: string;
  subtitle: string;
  message: string;
  opens: string;
}

@injectable()
export class TerminalNotifier {
  constructor(
    @inject(Fs) private readonly fs: Fs,
    @inject(Identicon) private readonly identicon: Identicon,
    @inject(Logger) private readonly logger: Logger,
    @inject(TerminalNotifierCommand)
    private readonly command: TerminalNotifierCommand,
    @inject(Vscode) private readonly vscode: Vscode,
  ) {}

  private code: string | undefined;

  async post(notification: Notification, signal: AbortSignal) {
    const { opens, group, title, subtitle, message } = notification;
    this.code ??= await this.cli();
    const execute = quote([this.code, opens]);
    const imagePath = await this.identicon.for(group);
    signal.throwIfAborted();
    this.logger.trace("posting", { notification, execute, imagePath });
    return this.command.post({
      group,
      title,
      subtitle,
      message,
      execute,
      imagePath,
    });
  }

  private async cli() {
    const { appRoot } = this.vscode.env;
    const { applicationName } = ProductSchema.parse(
      JSON.parse(await this.fs.readFile(join(appRoot, "product.json"))),
    );
    return join(appRoot, "bin", applicationName);
  }
}
