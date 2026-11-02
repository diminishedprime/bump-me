import { createHash } from "node:crypto";
import { basename } from "node:path";

export class WorkspaceId {
  static readonly DIRECTORY = "/tmp/bump-me";

  constructor(readonly directory = WorkspaceId.DIRECTORY) {}

  // basename + a hash of the full path. So folders that share a name can be kept distinct.
  // e.g.
  //   ~/parallel-lab-2026-10-31/lab -> lab_47df4dae7a43
  //   ~/parallel-lab-2026-11-02/lab -> lab_c38d9ffe4e95
  for(root: string) {
    const hash = createHash("sha256").update(root).digest("hex").slice(0, 12);
    return `${basename(root)}_${hash}`;
  }
}
