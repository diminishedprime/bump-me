import { dirname } from "node:path";
import type { Duplex } from "node:stream";
import { text } from "node:stream/consumers";
import { inject, injectable } from "tsyringe";
import { Fs } from "#src/fs";

export type Receive = (payload: string) => Promise<void>;

@injectable()
export class HookSocket {
  private readonly aborter = new AbortController();

  constructor(@inject(Fs) private readonly fs: Fs) {}

  async listen(path: string, receive: Receive, failed: (error: Error) => void) {
    await this.fs.mkdir(dirname(path));
    await this.fs.rm(path);
    this.fs.listen(
      path,
      async (connection) => HookSocket.serve(connection, receive),
      failed,
      this.aborter.signal,
    );
  }

  dispose() {
    this.aborter.abort();
  }

  private static async serve(connection: Duplex, receive: Receive) {
    await receive(await text(connection));
    connection.end();
  }
}
