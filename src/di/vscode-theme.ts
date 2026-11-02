import { dirname, join } from "node:path";
import { parse } from "jsonc-parser";
import { inject, injectable } from "tsyringe";
import * as z from "zod/mini";
import { Logger } from "#src/di/logger";
import { Fs } from "#src/fs";
import { Vscode } from "#src/vscode";

const HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const ManifestSchema = z.object({
  contributes: z.optional(
    z.object({
      themes: z.optional(
        z.array(
          z.object({
            id: z.optional(z.string()),
            label: z.string(),
            path: z.string(),
          }),
        ),
      ),
    }),
  ),
});

const ThemeFileSchema = z.object({
  include: z.optional(z.string()),
  colors: z.optional(z.record(z.string(), z.string())),
  tokenColors: z.catch(
    z.optional(
      z.array(
        z.object({
          settings: z.object({ foreground: z.optional(z.string()) }),
        }),
      ),
    ),
    undefined,
  ),
});

type ThemeFile = z.infer<typeof ThemeFileSchema>;

export type RGB = readonly [red: number, green: number, blue: number];

export interface Foreground {
  color: RGB;
  uses: number;
}

@injectable()
export class VscodeTheme {
  constructor(
    @inject(Fs) private readonly fs: Fs,
    @inject(Logger) private readonly logger: Logger,
    @inject(Vscode) private readonly vscode: Vscode,
  ) {}

  async colors() {
    const theme = await this.active();
    return {
      background: this.background(theme),
      foregrounds: VscodeTheme.foregrounds(theme),
    };
  }

  private background(theme: ThemeFile | undefined): RGB {
    const background = VscodeTheme.rgb(
      theme?.colors?.["editor.background"] ?? "",
    );
    if (background === undefined) {
      this.logger.warn("the active theme has no editor.background");
      return [0, 0, 0];
    }
    return background;
  }

  private static foregrounds(theme: ThemeFile | undefined) {
    const foregrounds = new Map<string, Foreground>();
    for (const { settings } of theme?.tokenColors ?? []) {
      const color = VscodeTheme.rgb(settings.foreground ?? "");
      if (color === undefined) {
        continue;
      }
      const key = color.join(",");
      foregrounds.set(key, {
        color,
        uses: (foregrounds.get(key)?.uses ?? 0) + 1,
      });
    }
    return [...foregrounds.values()];
  }

  private static rgb(color: string): RGB | undefined {
    const digits = HEX_COLOR.exec(color)?.[1];
    if (digits === undefined) {
      return undefined;
    }
    const full = digits.length <= 4 ? digits.replaceAll(/./g, "$&$&") : digits;
    const bytes = Buffer.from(full, "hex");
    return [bytes.readUInt8(0), bytes.readUInt8(1), bytes.readUInt8(2)];
  }

  name() {
    return this.vscode.workspace
      .getConfiguration("workbench")
      .get("colorTheme");
  }

  private async active() {
    const active = this.name();
    for (const { extensionPath, packageJSON } of this.vscode.extensions.all) {
      const themes =
        ManifestSchema.safeParse(packageJSON).data?.contributes?.themes ?? [];
      for (const theme of themes) {
        if ((theme.id ?? theme.label) === active) {
          return this.load(join(extensionPath, theme.path));
        }
      }
    }
    return undefined;
  }

  private async load(path: string): Promise<ThemeFile | undefined> {
    let contents: string;
    try {
      contents = await this.fs.readFile(path);
    } catch {
      return undefined;
    }
    const theme = ThemeFileSchema.safeParse(parse(contents)).data;
    if (theme?.include === undefined) {
      return theme;
    }
    const base = await this.load(join(dirname(path), theme.include));
    return {
      colors: { ...base?.colors, ...theme.colors },
      tokenColors: [...(base?.tokenColors ?? []), ...(theme.tokenColors ?? [])],
    };
  }
}
