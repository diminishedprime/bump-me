import "#src/reflection";
import {
  container,
  type DependencyContainer,
  instanceCachingFactory,
} from "tsyringe";
import { afterEach, expect, onTestFinished, vi } from "vitest";
import { start } from "#src/di/graph";
import { Fs } from "#src/fs";
import { TerminalNotifierCommand } from "#src/terminal-notifier-command";
import { Vscode, type VSCodeWorkspace } from "#src/vscode";
import { ClaudeCode } from "#test/setup/outside/claude-code";
import { Code } from "#test/setup/outside/code";
import { FakeFs } from "#test/setup/fakes/fs";
import { Macos } from "#test/setup/outside/macos";
import {
  NotificationCenter,
  type Which,
} from "#test/setup/outside/notification-center";
import { FakeTerminalNotifierCommand } from "#test/setup/fakes/terminal-notifier-command";
import {
  type Editor,
  FakeVscode,
  type ThemeName,
} from "#test/setup/fakes/vscode";

interface Initial {
  vscode: "focused" | "unfocused";
  workspace: string[] | undefined;
  workspaceFile?: VSCodeWorkspace["workspaceFile"];
  aiTitle?: string;
  theme?: ThemeName;
  editor?: Editor;
}

type WindowName = keyof typeof windows;

type InitialState = Omit<Initial, "workspace" | "workspaceFile" | "aiTitle">;

export interface TestWindow {
  oob: {
    vscode: {
      focus(): Promise<void>;
      unfocus(): Promise<void>;
      idle(): Promise<void>;
      close(): Promise<void>;
      changeTheme(theme: ThemeName): void;
    };
    claude: {
      finishedTurn(): Promise<void>;
      permissionRequest(description: string): Promise<void>;
      undescribedPermissionRequest(): Promise<void>;
      mcpPermissionRequest(): Promise<void>;
      submitPrompt(): Promise<void>;
      retitle(customTitle: string): void;
    };
    macos: {
      clickNotification(which?: Which): Promise<void>;
    };
  };
}

export type TestHarness<Name extends WindowName> = Record<Name, TestWindow> & {
  macos: {
    notifications: NotificationCenter;
  };
  code: Code;
  disk: FakeFs;
};

const windows = {
  bumpMe: {
    workspace: ["/Users/me/programming/bump-me"],
    aiTitle: "Remove the capture file",
  },
  mindfulStage: {
    workspace: ["/Users/me/programming/mindful-stage"],
    aiTitle: "Tidy up the stage",
  },
  dotfiles: { workspace: ["/Users/me/programming/dotfiles"] },
  multiRoot: {
    workspace: ["/Users/me/programming/notes", "/Users/me/programming/recipes"],
    workspaceFile: {
      scheme: "file",
      fsPath: "/Users/me/programming/side-projects.code-workspace",
    },
  },
  untitledMultiRoot: {
    workspace: ["/Users/me/programming/notes", "/Users/me/programming/recipes"],
    workspaceFile: { scheme: "untitled", fsPath: "1793664027099" },
  },
  noWorkspace: { workspace: undefined },
  emptyWorkspace: { workspace: [] },
} satisfies Record<
  string,
  Pick<Initial, "workspace" | "workspaceFile" | "aiTitle">
>;

afterEach(() => {
  vi.useRealTimers();
});

interface Overrides {
  disk?: typeof FakeFs;
}

export async function freshHarness<Name extends WindowName>(
  initialStates: Record<Name, InitialState>,
  overrides: Overrides = {},
): Promise<TestHarness<Name>> {
  const world = World.create(overrides);
  const opened = Object.fromEntries(
    await Promise.all(
      (Object.keys(initialStates) as Name[]).map(
        async (name) =>
          [
            name,
            await world.open({ ...windows[name], ...initialStates[name] }),
          ] as const,
      ),
    ),
  ) as Record<Name, TestWindow>;
  const macos = world.container.resolve(Macos);
  const code = world.container.resolve(Code);
  const disk = world.container.resolve(FakeFs);

  return { ...opened, macos, code, disk };
}

class World {
  private constructor(readonly container: DependencyContainer) {}

  static create({ disk = FakeFs }: Overrides) {
    return new World(
      container
        .createChildContainer()
        .registerSingleton(Code)
        .registerSingleton(FakeFs, disk)
        .register(Fs, { useToken: FakeFs })
        .registerSingleton(NotificationCenter)
        .registerSingleton(Macos),
    );
  }

  private windowContainer({
    vscode: focus,
    workspace,
    workspaceFile,
    aiTitle,
    theme,
    editor,
  }: Initial) {
    const root = workspace?.[0];
    return this.container
      .createChildContainer()
      .register(FakeVscode, {
        useFactory: instanceCachingFactory(
          () => new FakeVscode(focus, workspace, workspaceFile, theme, editor),
        ),
      })
      .register(Vscode, { useToken: FakeVscode })
      .registerSingleton(FakeTerminalNotifierCommand)
      .register(TerminalNotifierCommand, {
        useToken: FakeTerminalNotifierCommand,
      })
      .register(ClaudeCode, {
        useFactory: instanceCachingFactory(
          (resolver) => new ClaudeCode(resolver.resolve(FakeFs), root, aiTitle),
        ),
      });
  }

  private static failOnLoggedErrors(vscode: FakeVscode) {
    onTestFinished(() => {
      expect(
        vscode.window.lines.filter(([level]) => level === "error"),
        "expected the extension to log no errors",
      ).toEqual([]);
    });
  }

  async open(initial: Initial): Promise<TestWindow> {
    const window = this.windowContainer(initial);
    const running = await start(window);

    const vscode = window.resolve(FakeVscode);
    vscode.window.onDidClose(async () => {
      await running.disposeAsync();
      await window.dispose();
    });
    const claude = window.resolve(ClaudeCode);
    const macos = window.resolve(Macos);

    World.failOnLoggedErrors(vscode);

    return { oob: { vscode, claude, macos } };
  }
}
