import "#src/reflection";
import { container } from "tsyringe";
import {
  env,
  type ExtensionContext,
  extensions,
  window,
  workspace,
} from "vscode";
import { start } from "#src/di/graph";
import { Logger } from "#src/di/logger";
import type { Lifetime } from "#src/lifetime";
import { Vscode } from "#src/vscode";

let running: Lifetime | undefined;

export async function activate(context: ExtensionContext) {
  container.register(Vscode, {
    useValue: new Vscode(window, workspace, env, extensions, context),
  });
  try {
    running = await start(container);
  } catch (error) {
    if (error instanceof Error) {
      container.resolve(Logger).error("bump-me failed to start", error);
    }
    throw error;
  }
}

export async function deactivate() {
  await running?.disposeAsync();
  await container.dispose();
}
