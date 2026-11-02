import { inject, injectable } from "tsyringe";
import { WorkspaceId } from "#src/workspace-id";
import { Logger } from "#src/di/logger";
import { Store } from "#src/di/store";
import { Vscode } from "#src/vscode";

@injectable()
export class CurrentWorkspaceId {
  constructor(
    @inject(WorkspaceId) private readonly workspaceIdLookup: WorkspaceId,
    @inject(Logger) private readonly logger: Logger,
    @inject(Store) private readonly store: Store,
    @inject(Vscode) private readonly vscode: Vscode,
  ) {}

  start() {
    const root = this.vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root === undefined) {
      this.logger.info("no workspace folder, so no workspace id");
      return;
    }
    this.logger.trace("looking up workspace id", { root });
    const id = this.workspaceIdLookup.for(root);
    this.logger.info(`workspace id ${id} for ${root}`);
    this.store.workspaceId = id;
  }
}
