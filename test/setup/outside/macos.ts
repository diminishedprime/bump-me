import { inject, injectable } from "tsyringe";
import {
  NotificationCenter,
  type Which,
} from "#test/setup/outside/notification-center";

@injectable()
export class Macos {
  constructor(
    @inject(NotificationCenter)
    readonly notifications: NotificationCenter,
  ) {}

  async clickNotification(which: Which = {}) {
    await this.notifications.click(which);
  }
}
