import { basename, join } from "node:path";
import type { WindowState } from "vscode";
import fakeBroken from "#fixtures/themes/fake-broken/package.json";
import fakeDark from "#fixtures/themes/fake-dark/package.json";
import fakeInclude from "#fixtures/themes/fake-include/package.json";
import fakeLight from "#fixtures/themes/fake-light/package.json";
import fakeMissing from "#fixtures/themes/fake-missing/package.json";
import fakeTextMate from "#fixtures/themes/fake-textmate/package.json";
import fakeXml from "#fixtures/themes/fake-xml/package.json";
import type { builtInThemes } from "#fixtures/themes/built-in-themes.ts";
import themeDefaults from "#fixtures/themes/theme-defaults/package.json";
import {
  Vscode,
  type VSCodeExtensions,
  type VSCodeWindow,
  type VSCodeWorkspace,
} from "#src/vscode";

class FakeWindow implements VSCodeWindow {
  private readonly listeners = new Set<(state: WindowState) => unknown>();
  private readonly closers = new Set<() => Promise<void>>();

  constructor(public state: WindowState) {}

  onDidChangeWindowState: VSCodeWindow["onDidChangeWindowState"] = (
    listener,
  ) => {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  };

  readonly lines: [level: string, message: string][] = [];
  disposed = false;

  createOutputChannel: VSCodeWindow["createOutputChannel"] = () => ({
    trace: (message) => {
      this.lines.push(["trace", message]);
    },
    debug: (message) => {
      this.lines.push(["debug", message]);
    },
    info: (message) => {
      this.lines.push(["info", message]);
    },
    warn: (message) => {
      this.lines.push(["warn", message]);
    },
    error: (message) => {
      this.lines.push(["error", String(message)]);
    },
    dispose: () => {
      this.disposed = true;
    },
  });

  async focus() {
    await this.change({ focused: true, active: true });
  }

  async unfocus() {
    await this.change({ focused: false, active: true });
  }

  async idle() {
    await this.change({ focused: false, active: false });
  }

  onDidClose(listener: () => Promise<void>) {
    this.closers.add(listener);
  }

  async close() {
    await Promise.all(
      [...this.closers].map(async (closer) => {
        await closer();
      }),
    );
  }

  private async change(state: WindowState) {
    this.state = state;
    await Promise.all([...this.listeners].map((listener) => listener(state)));
  }
}

export const editors = {
  "VS Code": {
    appRoot: "/Applications/Visual Studio Code.app/Contents/Resources/app",
    applicationName: "code",
  },
  "VS Code Insiders": {
    appRoot:
      "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app",
    applicationName: "code-insiders",
  },
};

export type Editor = keyof typeof editors;

const themes = join(import.meta.dirname, "..", "..", "fixtures", "themes");

const extensions: VSCodeExtensions = {
  all: (
    [
      ["fake-dark", fakeDark],
      ["fake-include", fakeInclude],
      ["fake-light", fakeLight],
      ["fake-missing", fakeMissing],
      ["fake-textmate", fakeTextMate],
      ["fake-xml", fakeXml],
      ["theme-defaults", themeDefaults],
      ["fake-broken", fakeBroken],
    ] as const
  ).map(([name, packageJSON]) => ({
    extensionPath: join(themes, name),
    packageJSON,
  })),
};

export type ThemeName =
  | "Fake Broken"
  | "Fake Dark"
  | "Fake Include"
  | "Fake Light"
  | "Fake Missing"
  | "Fake TextMate"
  | "Fake XML"
  | (typeof builtInThemes)[number];

export class FakeVscode extends Vscode {
  declare readonly window: FakeWindow;
  private readonly settings: { theme: ThemeName };

  constructor(
    focus: "focused" | "unfocused",
    workspace: string[] | undefined,
    workspaceFile: VSCodeWorkspace["workspaceFile"],
    theme: ThemeName = "Fake Dark",
    editor: Editor = "VS Code",
  ) {
    const settings = { theme };
    const folders: VSCodeWorkspace = {
      workspaceFolders: workspace?.map((folder) => ({
        name: basename(folder),
        uri: { fsPath: folder },
      })),
      workspaceFile,
      getConfiguration: (section) => ({
        get: (key) =>
          `${section}.${key}` === "workbench.colorTheme"
            ? settings.theme
            : undefined,
      }),
    };
    super(
      new FakeWindow({ focused: focus === "focused", active: true }),
      folders,
      { appRoot: editors[editor].appRoot },
      extensions,
      {
        globalStorageUri: {
          fsPath:
            "/Users/me/Library/Application Support/Code/User/globalStorage/diminishedprime.bump-me",
        },
      },
    );
    this.settings = settings;
  }

  async focus() {
    await this.window.focus();
  }

  async unfocus() {
    await this.window.unfocus();
  }

  async idle() {
    await this.window.idle();
  }

  async close() {
    await this.window.close();
  }

  changeTheme(theme: ThemeName) {
    this.settings.theme = theme;
  }
}
