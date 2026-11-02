import { createHash } from "node:crypto";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { inject, Lifecycle, scoped } from "tsyringe";
import { WorkspaceId } from "#src/workspace-id";
import { type Foreground, type RGB, VscodeTheme } from "#src/di/vscode-theme";
import { Fs } from "#src/fs";

const CELL = 40;
const CELLS = 5;
const GRID = CELLS + 2;
const SIZE = CELL * GRID;
const DECIDED = CELLS * Math.ceil(CELLS / 2);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const MINIMUM_CONTRAST = 3;
const RELATIVE_SATURATION = 0.25;
const PALETTE_SIZE = 3;

@scoped(Lifecycle.ContainerScoped)
export class Identicon {
  private readonly written = new Map<string, unknown>();

  constructor(
    @inject(Fs) private readonly fs: Fs,
    @inject(WorkspaceId) private readonly workspaceIdLookup: WorkspaceId,
    @inject(VscodeTheme) private readonly theme: VscodeTheme,
  ) {}

  async for(group: string) {
    const path = join(this.workspaceIdLookup.directory, `${group}.png`);
    const theme = this.theme.name();
    if (this.written.has(path) && this.written.get(path) === theme) {
      return path;
    }
    const { background, foregrounds } = await this.theme.colors();
    const palette = Identicon.palette(foregrounds, background);
    const cells = Identicon.cells(
      createHash("sha256").update(group).digest(),
      palette,
      background,
    );
    const pixels = Identicon.pixels(cells, background);
    const blob = Identicon.encode(pixels);
    await this.fs.writeFile(path, blob);
    this.written.set(path, theme);
    return path;
  }

  async [Symbol.asyncDispose]() {
    await Promise.all(
      [...this.written.keys()].map(async (path) => {
        await this.fs.rm(path);
      }),
    );
    this.written.clear();
  }

  private static palette(foregrounds: Foreground[], background: RGB) {
    const visible = foregrounds.filter(
      ({ color }) => Identicon.contrast(color, background) >= MINIMUM_CONTRAST,
    );
    const highest = Math.max(
      ...visible.map(({ color }) => Identicon.saturation(color)),
    );
    return visible
      .filter(
        ({ color }) =>
          Identicon.saturation(color) >= RELATIVE_SATURATION * highest,
      )
      .sort((a, b) => b.uses - a.uses)
      .slice(0, PALETTE_SIZE)
      .map(({ color }) => color);
  }

  private static saturation(color: RGB) {
    const channels = color.map((channel) => channel / 255);
    const max = Math.max(...channels);
    const min = Math.min(...channels);
    const lightness = (max + min) / 2;
    return max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
  }

  private static luminance([red, green, blue]: RGB) {
    return (
      0.2126 * Identicon.linear(red) +
      0.7152 * Identicon.linear(green) +
      0.0722 * Identicon.linear(blue)
    );
  }

  private static linear(channel: number) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }

  private static contrast(color: RGB, background: RGB) {
    const foreground = Identicon.luminance(color);
    const behind = Identicon.luminance(background);
    return foreground > behind
      ? (foreground + 0.05) / (behind + 0.05)
      : (behind + 0.05) / (foreground + 0.05);
  }

  private static pixels(cells: RGB[], background: RGB) {
    const pixels = Buffer.alloc(SIZE * SIZE * 3);
    const band = Buffer.alloc(SIZE * 3);
    for (let row = 0; row < GRID; row++) {
      for (let column = 0; column < GRID; column++) {
        const border =
          row === 0 || column === 0 || row === GRID - 1 || column === GRID - 1;
        const color = border
          ? background
          : Identicon.cellFor(cells, row - 1, column - 1);
        band.fill(
          Buffer.from(color),
          column * CELL * 3,
          (column + 1) * CELL * 3,
        );
      }
      for (let line = 0; line < CELL; line++) {
        band.copy(pixels, (row * CELL + line) * SIZE * 3);
      }
    }
    return pixels;
  }

  private static encode(pixels: Buffer) {
    const stride = SIZE * 3;
    const rows = Buffer.alloc(SIZE * (1 + stride));
    for (let y = 0; y < SIZE; y++) {
      pixels.copy(rows, y * (1 + stride) + 1, y * stride, (y + 1) * stride);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(SIZE, 0);
    header.writeUInt32BE(SIZE, 4);
    header[8] = 8;
    header[9] = 2;
    return Buffer.concat([
      PNG_SIGNATURE,
      Identicon.chunk("IHDR", header),
      Identicon.chunk("IDAT", deflateSync(rows, { level: 0 })),
      Identicon.chunk("IEND", Buffer.alloc(0)),
    ]);
  }

  private static chunk(type: string, data: Buffer) {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const framed = Buffer.alloc(body.length + 8);
    framed.writeUInt32BE(data.length, 0);
    body.copy(framed, 4);
    framed.writeUInt32BE(crc32(body), body.length + 4);
    return framed;
  }

  private static cells(hash: Buffer, palette: RGB[], background: RGB) {
    const filled = Array.from({ length: DECIDED }, (_, cell) =>
      // cell stays below 15 and the sha256 digest is 32 bytes
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      Boolean(hash[cell]! & 1),
    );
    for (
      let cell = 0;
      cell < DECIDED && filled.filter(Boolean).length < palette.length;
      cell++
    ) {
      filled[cell] = true;
    }
    // DECIDED is 15 and the sha256 digest is 32 bytes
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const offset = hash[DECIDED]!;
    let next = 0;
    return filled.map((isFilled) =>
      isFilled && palette.length > 0
        ? // the modulo keeps the index below palette.length
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          palette[(offset + next++) % palette.length]!
        : background,
    );
  }

  private static cellFor(cells: RGB[], row: number, column: number) {
    const decided = Math.min(column, CELLS - 1 - column);
    // row stays below 5 and decided below 3, so the index stays below 15
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return cells[row * Math.ceil(CELLS / 2) + decided]!;
  }
}
