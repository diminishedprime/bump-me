import { expect } from "vitest";

export class Code {
  readonly opened: string[] = [];

  open(workspace: string) {
    this.opened.push(workspace);
  }
}

declare module "vitest" {
  interface Matchers<R, T> {
    openedWorkspace: T extends Code ? (workspace?: string) => R : never;
  }
}

expect.extend({
  openedWorkspace(code: Code, workspace?: string) {
    const what =
      workspace === undefined
        ? "a workspace"
        : this.utils.printExpected(workspace);
    return {
      pass:
        workspace === undefined
          ? code.opened.length > 0
          : code.opened.includes(workspace),
      message: () =>
        this.isNot
          ? `expected not to open ${what}, but opened ${this.utils.printReceived(code.opened)}`
          : `expected to open ${what}, but opened ${this.utils.printReceived(code.opened)}`,
    };
  },
});
