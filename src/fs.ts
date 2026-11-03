import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import type { Duplex } from "node:stream";

export class Fs {
  async readFile(path: string) {
    return readFile(path, "utf8");
  }

  async *lines(path: string, from = 0) {
    await using file = await open(path);
    yield* file.readLines({ start: from });
  }

  async writeFile(path: string, data: Buffer) {
    await writeFile(path, data);
  }

  async rm(path: string) {
    await rm(path, { force: true });
  }

  async mkdir(path: string) {
    await mkdir(path, { recursive: true });
  }

  listen(
    path: string,
    serve: (connection: Duplex) => Promise<void>,
    failed: (error: Error) => void,
    signal: AbortSignal,
  ) {
    createServer((connection) => {
      void serve(connection);
    })
      .on("error", failed)
      .listen({ path, signal });
  }
}
