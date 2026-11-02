import { EventEmitter, once } from "node:events";
import { setImmediate } from "node:timers/promises";
import { PNG } from "pngjs";
import { parse } from "shell-quote";
import { inject, injectable } from "tsyringe";
import { expect } from "vitest";
import type {
  Notification,
  Posted,
  TerminalNotifierCommand,
} from "#src/terminal-notifier-command";
import { Code } from "#test/setup/outside/code";
import { FakeFs } from "#test/setup/fakes/fs";
import type { HexColorLike, HexColors } from "#test/setup/hex-color";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type Visible = Pick<Notification, "title" | "subtitle" | "message">;

export type Which = Partial<
  Visible & {
    imageColors: readonly HexColorLike[];
    imageWithoutColors: readonly HexColorLike[];
  }
>;

type Checked<W extends Which> = W & {
  imageColors?: HexColors<W["imageColors"]>;
  imageWithoutColors?: HexColors<W["imageWithoutColors"]>;
};

@injectable()
export class NotificationCenter implements Pick<
  TerminalNotifierCommand,
  "post"
> {
  readonly showing = new Set<Notification>();
  private readonly closed = new EventEmitter();

  constructor(
    @inject(Code) private readonly code: Code,
    @inject(FakeFs) private readonly fs: FakeFs,
  ) {}

  async attaches(imagePath: string) {
    return (
      (await this.fs.exists(imagePath)) &&
      (await this.fs.readBytes(imagePath)).subarray(0, 8).equals(PNG_SIGNATURE)
    );
  }

  async image(imagePath: string) {
    if (!(await this.attaches(imagePath))) {
      return undefined;
    }
    const { data } = PNG.sync.read(await this.fs.readBytes(imagePath));
    const pixels = new Uint32Array(
      data.buffer,
      data.byteOffset,
      data.length / 4,
    );
    const colors = new Set<number>();
    // indexing a Uint32Array is faster than its iterator
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let index = 0; index < pixels.length; index++) {
      // index stays below pixels.length by construction
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      colors.add(pixels[index]! & 0xffffff);
    }
    return colors;
  }

  static packed(color: string) {
    const value = Number.parseInt(color.slice(1), 16);
    return (value >> 16) | (value & 0xff00) | ((value & 0xff) << 16);
  }

  async matches(
    which: Which,
    { title, subtitle, message, imagePath }: Notification,
  ) {
    const { imageColors, imageWithoutColors, ...text } = which;
    const visible: Visible = { title, subtitle, message };
    if (
      !Object.entries(text).every(
        ([field, value]) => visible[field as keyof Visible] === value,
      )
    ) {
      return false;
    }
    if (imageColors === undefined && imageWithoutColors === undefined) {
      return true;
    }
    const shown = (await this.image(imagePath)) ?? new Set();
    const showing = (color: string) =>
      shown.has(NotificationCenter.packed(color));
    return (
      (imageColors ?? []).every(showing) &&
      !(imageWithoutColors ?? []).some(showing)
    );
  }

  async post(notification: Notification): Promise<Posted> {
    await setImmediate();
    this.showing.add(notification);
    return {
      closed: this.closing(notification.group),
      [Symbol.asyncDispose]: async () => {
        await this.remove(notification.group);
      },
    };
  }

  private async closing(group: string) {
    await once(this.closed, group);
  }

  private async remove(group: string) {
    await setImmediate();
    for (const showing of this.showing) {
      if (showing.group === group) {
        this.close(showing);
      }
    }
  }

  private close(notification: Notification) {
    this.showing.delete(notification);
    this.closed.emit(notification.group);
  }

  async click(which: Which) {
    const matching = await Promise.all(
      [...this.showing].map(async (showing) => this.matches(which, showing)),
    );
    const [notification, ...others] = [...this.showing].filter(
      (_, index) => matching[index],
    );
    if (notification === undefined) {
      throw new Error(
        "expected exactly one showing notification to match, but found none",
      );
    }
    if (others.length > 0) {
      throw new Error(
        `expected exactly one showing notification to match, but found ${String(others.length + 1)}`,
      );
    }
    this.close(notification);
    const [program, workspace, ...rest] = parse(notification.execute);
    if (typeof program !== "string") {
      throw new Error(
        `expected clicking to run a program, but it runs ${notification.execute}`,
      );
    }
    if (typeof workspace !== "string") {
      throw new Error(
        `expected clicking to pass a workspace, but it runs ${notification.execute}`,
      );
    }
    if (rest.length > 0) {
      throw new Error(
        `expected clicking to pass only a workspace, but it runs ${notification.execute}`,
      );
    }
    if (await this.fs.exists(program)) {
      this.code.open(workspace);
    }
  }
}

declare module "vitest" {
  interface Matchers<R, T> {
    showing: T extends NotificationCenter
      ? <const W extends Which>(which?: Checked<W>) => Promise<R>
      : never;
  }
}

expect.extend({
  async showing(notifications: NotificationCenter, which: Which = {}) {
    const what = ` matching ${this.utils.printExpected(which)}`;
    const matching = await Promise.all(
      [...notifications.showing].map(async (showing) =>
        notifications.matches(which, showing),
      ),
    );
    return {
      pass: matching.some(Boolean),
      message: () =>
        this.isNot
          ? `expected no notification showing${what}, but showing ${this.utils.printReceived([...notifications.showing])}`
          : `expected a notification showing${what}, but showing ${this.utils.printReceived([...notifications.showing])}`,
    };
  },
});
