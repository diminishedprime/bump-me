import { join } from "node:path";
import { inject, Lifecycle, scoped } from "tsyringe";
import * as z from "zod/mini";
import { WorkspaceId } from "#src/workspace-id";

export const SessionIdSchema = z.string().brand<"SessionId">();
type SessionId = z.infer<typeof SessionIdSchema>;
type SeenTitle =
  | { kind: "untitled"; scanned: number }
  | { kind: "custom"; customTitle: string };
type KnownTitle = { kind: "unseen" } | SeenTitle;

@scoped(Lifecycle.ContainerScoped)
export class Store {
  focused = true;
  workspaceId: string | undefined;
  private readonly seenTitles = new Map<SessionId, SeenTitle>();

  constructor(
    @inject(WorkspaceId) private readonly workspaceIdLookup: WorkspaceId,
  ) {}

  get socketFile() {
    return this.workspaceId === undefined
      ? undefined
      : join(this.workspaceIdLookup.directory, `${this.workspaceId}.sock`);
  }

  rememberUntitled(sessionId: SessionId, scanned = this.scanned(sessionId)) {
    this.seenTitles.set(sessionId, { kind: "untitled", scanned });
  }

  rememberCustomTitle(sessionId: SessionId, customTitle: string) {
    this.seenTitles.set(sessionId, { kind: "custom", customTitle });
  }

  knownTitle(sessionId: SessionId): KnownTitle {
    return this.seenTitles.get(sessionId) ?? { kind: "unseen" };
  }

  private scanned(sessionId: SessionId) {
    const seen = this.seenTitles.get(sessionId);
    return seen?.kind === "untitled" ? seen.scanned : 0;
  }
}
