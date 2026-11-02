import { mkdir, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { dirname } from "node:path";
import { text } from "node:stream/consumers";

export type Receive = (payload: string) => Promise<void>;

export class HookSocket {
  private readonly aborter = new AbortController();

  async listen(path: string, receive: Receive, failed: (error: Error) => void) {
    await mkdir(dirname(path), { recursive: true });
    await rm(path, { force: true });
    createServer((connection) => {
      void HookSocket.serve(connection, receive);
    })
      .on("error", failed)
      .listen({ path, signal: this.aborter.signal });
  }

  dispose() {
    this.aborter.abort();
  }

  private static async serve(connection: Socket, receive: Receive) {
    await receive(await text(connection));
    connection.end();
  }
}
