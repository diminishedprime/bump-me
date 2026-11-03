import { join } from "node:path";
import { Duplex } from "node:stream";
import { createFsFromVolume, Volume } from "memfs";
import { expect } from "vitest";
import { WorkspaceId } from "#src/workspace-id";
import { Fs } from "#src/fs";
import { editors } from "#test/setup/fakes/vscode";

const themeFiles = import.meta.glob<string>(
  "../../fixtures/themes/*/themes/*",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const editorFiles = Object.values(editors).flatMap(
  ({ appRoot, applicationName }) => [
    [
      join(appRoot, "product.json"),
      JSON.stringify({ applicationName }),
    ] as const,
    [join(appRoot, "bin", applicationName), ""] as const,
  ],
);

export class FakeFs extends Fs {
  private readonly sockets = new Map<
    string,
    (connection: Duplex) => Promise<void>
  >();
  private readonly memory = createFsFromVolume(
    Volume.fromJSON({
      ...Object.fromEntries(
        Object.entries(themeFiles).map(([path, contents]) => [
          join(import.meta.dirname, path),
          contents,
        ]),
      ),
      ...Object.fromEntries(editorFiles),
      [WorkspaceId.DIRECTORY]: null,
    }),
  );

  async identicons() {
    return (await this.memory.promises.readdir(WorkspaceId.DIRECTORY))
      .filter((name) => typeof name === "string")
      .filter((name) => name.endsWith(".png"))
      .map((name) => join(WorkspaceId.DIRECTORY, name));
  }

  async identiconsWrittenAt() {
    return Promise.all(
      (await this.identicons()).map(
        async (path) => (await this.memory.promises.stat(path)).mtimeMs,
      ),
    );
  }

  override async readFile(path: string) {
    return (await this.memory.promises.readFile(path, "utf8")) as string;
  }

  override async *lines(path: string, from = 0) {
    const contents = Buffer.from(await this.readFile(path));
    yield* contents.subarray(from).toString().split("\n");
  }

  override async writeFile(path: string, data: Buffer) {
    await this.memory.promises.writeFile(path, data);
  }

  override async rm(path: string) {
    this.sockets.delete(path);
    await this.memory.promises.rm(path, { force: true });
  }

  override async mkdir(path: string) {
    await this.memory.promises.mkdir(path, { recursive: true });
  }

  override listen(
    path: string,
    serve: (connection: Duplex) => Promise<void>,
    _failed: (error: Error) => void,
    signal: AbortSignal,
  ) {
    this.sockets.set(path, serve);
    signal.addEventListener("abort", () => {
      this.sockets.delete(path);
    });
  }

  async connect(path: string, payload: string) {
    const serve = this.sockets.get(path);
    if (serve === undefined) {
      return;
    }
    const connection = new Duplex({
      allowHalfOpen: false,
      read() {
        this.push(payload);
        this.push(null);
      },
      write(_chunk, _encoding, done) {
        done();
      },
    });
    await serve(connection);
  }

  async exists(path: string) {
    try {
      await this.memory.promises.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async readBytes(path: string) {
    return (await this.memory.promises.readFile(path)) as Buffer;
  }
}

declare module "vitest" {
  interface Matchers<R, T> {
    holdingIdenticons: T extends FakeFs ? () => Promise<R> : never;
  }
}

expect.extend({
  async holdingIdenticons(disk: FakeFs) {
    const identicons = await disk.identicons();
    return {
      pass: identicons.length > 0,
      message: () =>
        this.isNot
          ? `expected no identicons on disk, but found ${this.utils.printReceived(identicons)}`
          : "expected identicons on disk, but found none",
    };
  },
});
