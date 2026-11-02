import { inject, injectable } from "tsyringe";
import { Logger } from "#src/di/logger";
import { Notifier } from "#src/di/notifier";
import { Store } from "#src/di/store";
import { Vscode } from "#src/vscode";

@injectable()
export class WindowFocus {
  constructor(
    @inject(Logger) private readonly logger: Logger,
    @inject(Notifier) private readonly notifier: Notifier,
    @inject(Vscode) private readonly vscode: Vscode,
    @inject(Store) private readonly store: Store,
  ) {}

  start() {
    this.store.focused = this.vscode.window.state.focused;
    this.vscode.window.onDidChangeWindowState(async (state) => {
      this.logger.trace("window state changed", { state });
      await this.changed(state.focused);
    });
  }

  private async changed(focused: boolean) {
    this.store.focused = focused;
    if (focused) {
      await this.notifier.withdraw();
    }
  }
}
