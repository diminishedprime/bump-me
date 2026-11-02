import { HookSocket, type Receive } from "#src/hook-socket";

export class FakeHookSocket extends HookSocket {
  private listening: { path: string; receive: Receive } | undefined;

  override async listen(path: string, receive: Receive) {
    await Promise.resolve();
    this.listening = { path, receive };
  }

  async deliver(path: string, payload: string) {
    if (this.listening?.path === path) {
      await this.listening.receive(payload);
    }
  }
}
