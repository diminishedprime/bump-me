import type * as vscode from "vscode";

export type LogChannel = Pick<
  vscode.LogOutputChannel,
  "trace" | "debug" | "info" | "warn" | "error" | "dispose"
>;

export type VSCodeWindow = Pick<
  typeof vscode.window,
  "onDidChangeWindowState" | "state"
> & {
  createOutputChannel(name: string, options: { log: true }): LogChannel;
};

export interface VSCodeWorkspace {
  readonly workspaceFolders:
    | readonly (Pick<vscode.WorkspaceFolder, "name"> & {
        readonly uri: Pick<vscode.Uri, "fsPath">;
      })[]
    | undefined;
  getConfiguration(section: string): { get(key: string): unknown };
}

export type VSCodeEnv = Pick<typeof vscode.env, "appRoot">;

export interface VSCodeExtensions {
  readonly all: readonly Pick<
    vscode.Extension<unknown>,
    "extensionPath" | "packageJSON"
  >[];
}

export class Vscode {
  constructor(
    readonly window: VSCodeWindow,
    readonly workspace: VSCodeWorkspace,
    readonly env: VSCodeEnv,
    readonly extensions: VSCodeExtensions,
  ) {}
}
