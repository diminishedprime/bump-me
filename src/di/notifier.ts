import { dirname, join } from "node:path";
import { aborted } from "node:util";
import { inject, Lifecycle, scoped } from "tsyringe";
import { Logger } from "#src/di/logger";
import { Store } from "#src/di/store";
import { type Notification, TerminalNotifier } from "#src/di/terminal-notifier";
import type { Posted } from "#src/terminal-notifier-command";
import { Vscode } from "#src/vscode";

interface Ringing {
  scope: AbortController;
  finished: Promise<void>;
}

@scoped(Lifecycle.ContainerScoped)
export class Notifier {
  private ringing: Ringing | undefined;

  constructor(
    @inject(Logger) private readonly logger: Logger,
    @inject(Store) private readonly store: Store,
    @inject(TerminalNotifier)
    private readonly terminalNotifier: TerminalNotifier,
    @inject(Vscode) private readonly vscode: Vscode,
  ) {}

  async ring(
    subtitle: string,
    lazyTitle: () => Promise<string | undefined>,
    message: string,
  ) {
    if (this.store.focused) {
      return;
    }
    const folder = this.vscode.workspace.workspaceFolders?.[0];
    const workspaceId = this.store.workspaceId;
    this.logger.trace("ringing", { folder, workspaceId });
    if (folder === undefined || workspaceId === undefined) {
      throw new Error(
        "invariant: rang without a workspace folder and workspace id",
      );
    }
    this.logger.info(`notifying for ${folder.name} in group ${workspaceId}`);
    const previous = this.ringing;
    const scope = new AbortController();
    const posting = this.post(
      {
        group: workspaceId,
        title: folder.name,
        subtitle,
        message,
        opens: this.opens(folder.uri.fsPath),
      },
      lazyTitle,
      scope.signal,
      previous,
    );
    this.ringing = {
      scope,
      finished: this.finish(posting, workspaceId, scope.signal),
    };
    await Promise.allSettled([posting]);
  }

  private opens(folder: string) {
    const workspaceFile = this.vscode.workspace.workspaceFile;
    if (workspaceFile?.scheme === "untitled") {
      const userData = dirname(
        dirname(dirname(this.vscode.context.globalStorageUri.fsPath)),
      );
      return join(
        userData,
        "Workspaces",
        workspaceFile.fsPath,
        "workspace.json",
      );
    }
    return workspaceFile?.fsPath ?? folder;
  }

  async [Symbol.asyncDispose]() {
    await this.withdraw();
  }

  async withdraw() {
    const ringing = this.ringing;
    if (ringing === undefined) {
      return;
    }
    // Stryker disable next-line CallExpression: skipping the abort leaves
    // the ring waiting forever, so it can only be caught by a hang
    ringing.scope.abort();
    await ringing.finished;
  }

  private async post(
    notification: Notification,
    lazyTitle: () => Promise<string | undefined>,
    signal: AbortSignal,
    previous: Ringing | undefined,
  ) {
    if (previous !== undefined) {
      previous.scope.abort();
      await previous.finished;
    }
    const title = (await Notifier.titled(lazyTitle)) ?? notification.title;
    return this.terminalNotifier.post({ ...notification, title }, signal);
  }

  private static async titled(lazyTitle: () => Promise<string | undefined>) {
    try {
      return await lazyTitle();
    } catch {
      return undefined;
    }
  }

  private async finish(
    posting: Promise<Posted>,
    group: string,
    signal: AbortSignal,
  ) {
    let posted: Posted;
    try {
      posted = await posting;
    } catch (error) {
      if (signal.aborted) {
        this.logger.debug("ringing ended before it was shown", error);
      } else {
        this.logger.error("ringing failed", error);
      }
      return;
    }
    try {
      await using showing = posted;
      await Promise.race([showing.closed, aborted(signal, showing)]);
      this.logger.info(`withdrew notification in group ${group}`);
    } catch (error) {
      this.logger.error("withdrawing the notification failed", error);
    }
  }
}
