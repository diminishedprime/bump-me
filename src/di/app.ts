import { inject, injectable } from "tsyringe";
import { Claude } from "#src/di/claude/index";
import { Identicon } from "#src/di/identicon";
import { Logger } from "#src/di/logger";
import { Notifier } from "#src/di/notifier";
import { Store } from "#src/di/store";
import { WindowFocus } from "#src/di/window-focus";
import { Lifetime } from "#src/lifetime";

@injectable()
export class App {
  constructor(
    @inject(WindowFocus) private readonly windowFocus: WindowFocus,
    @inject(Claude) private readonly claude: Claude,
    @inject(Identicon) private readonly identicon: Identicon,
    @inject(Logger) private readonly logger: Logger,
    @inject(Notifier) private readonly notifier: Notifier,
    @inject(Store) private readonly store: Store,
  ) {}

  async start() {
    this.logger.trace("starting windowFocus");
    this.windowFocus.start();
    this.logger.trace("starting claude");
    await this.claude.start();
    this.logger.info("started", { workspaceId: this.store.workspaceId });
    return new Lifetime().using(this.identicon).using(this.notifier);
  }
}
