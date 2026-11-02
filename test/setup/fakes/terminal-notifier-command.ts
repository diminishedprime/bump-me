import { inject, injectable } from "tsyringe";
import {
  type Notification,
  TerminalNotifierCommand,
} from "#src/terminal-notifier-command";
import { NotificationCenter } from "#test/setup/outside/notification-center";

@injectable()
export class FakeTerminalNotifierCommand extends TerminalNotifierCommand {
  constructor(
    @inject(NotificationCenter)
    private readonly notifications: NotificationCenter,
  ) {
    super();
  }

  override async post(notification: Notification) {
    return this.notifications.post(notification);
  }
}
