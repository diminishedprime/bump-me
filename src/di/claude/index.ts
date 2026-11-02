import { inject, injectable } from "tsyringe";
import { ClaudeHooks } from "#src/di/claude/hooks";
import { CurrentWorkspaceId } from "#src/di/workspace-id";

@injectable()
export class Claude {
  constructor(
    @inject(ClaudeHooks) readonly hooks: ClaudeHooks,
    @inject(CurrentWorkspaceId) readonly workspaceId: CurrentWorkspaceId,
  ) {}

  async start() {
    this.workspaceId.start();
    await this.hooks.start();
  }
}
