import { open, readFile, rm, writeFile } from "node:fs/promises";

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
}
