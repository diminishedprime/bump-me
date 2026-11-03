import { dirname, join } from "node:path";
import permissionRequest from "#fixtures/hooks/accept-edits/permission-request.json";
import stop from "#fixtures/hooks/accept-edits/stop.json";
import transcript from "#fixtures/hooks/accept-edits/transcript.json";
import userPromptSubmit from "#fixtures/hooks/accept-edits/user-prompt-submit.json";
import workspaceIds from "#fixtures/workspace-ids.json";
import type { FakeFs } from "#test/setup/fakes/fs";

interface Payload {
  transcript_path: string;
}

export class ClaudeCode {
  static readonly HOME = "/Users/me";
  static readonly SESSION_ID = "fake-session";
  static readonly SOCKET_DIRECTORY = "/tmp/bump-me";

  constructor(
    private readonly fs: FakeFs,
    private readonly root: string | undefined,
    private readonly aiTitle: string | undefined,
  ) {}

  private customTitle: string | undefined;

  async finishedTurn() {
    await this.send(stop);
  }

  async permissionRequest(description: string) {
    const { command } = permissionRequest.tool_input;
    await this.sendPermissionRequest({ command, description });
  }

  async undescribedPermissionRequest() {
    const { command } = permissionRequest.tool_input;
    await this.sendPermissionRequest({ command });
  }

  async mcpPermissionRequest() {
    const request = {
      ...permissionRequest,
      tool_name: "mcp__notes__create_note",
      tool_input: {
        title: "Groceries",
        description: { format: "markdown", text: "Milk and eggs" },
      },
    };
    await this.send(request);
  }

  async submitPrompt() {
    const prompt =
      this.customTitle === undefined
        ? userPromptSubmit
        : { ...userPromptSubmit, session_title: this.customTitle };
    await this.send(prompt);
  }

  retitle(customTitle: string) {
    this.customTitle = customTitle;
  }

  private async sendPermissionRequest(toolInput: object) {
    const request = { ...permissionRequest, tool_input: toolInput };
    await this.send(request);
  }

  private async send(payload: Payload) {
    if (this.root === undefined) {
      return;
    }
    const transcriptPath = ClaudeCode.transcriptPath(payload, this.root);
    await this.writeTranscript(transcriptPath);
    const delivered = { ...payload, transcript_path: transcriptPath };
    await this.fs.connect(
      ClaudeCode.socketPath(this.root),
      JSON.stringify(delivered),
    );
  }

  private static transcriptPath(payload: Payload, root: string) {
    const workspaceSlug = root.replaceAll(/[^A-Za-z0-9]/g, "-");
    return payload.transcript_path
      .replaceAll("<home>", ClaudeCode.HOME)
      .replaceAll("<workspace-slug>", workspaceSlug)
      .replaceAll("<session_id>", ClaudeCode.SESSION_ID);
  }

  private async writeTranscript(path: string) {
    const lines = [
      ...transcript.flatMap((line) => this.withAiTitle(line)),
      ...this.customTitleLines(),
    ];
    const jsonl = lines.map((line) => JSON.stringify(line)).join("\n");
    await this.fs.mkdir(dirname(path));
    await this.fs.writeFile(path, Buffer.from(jsonl));
  }

  private withAiTitle(line: (typeof transcript)[number]): unknown[] {
    if (line.type !== "ai-title") {
      return [line];
    }
    if (this.aiTitle === undefined) {
      return [];
    }
    return [{ ...line, aiTitle: this.aiTitle }];
  }

  private customTitleLines(): unknown[] {
    if (this.customTitle === undefined) {
      return [];
    }
    const customTitle = {
      type: "custom-title",
      customTitle: this.customTitle,
      sessionId: ClaudeCode.SESSION_ID,
    };
    if (this.aiTitle === undefined) {
      return [customTitle];
    }
    const aiTitleAfterRename = {
      type: "ai-title",
      aiTitle: this.aiTitle,
      sessionId: ClaudeCode.SESSION_ID,
    };
    return [customTitle, aiTitleAfterRename];
  }

  private static socketPath(root: string) {
    const workspaceId = new Map(Object.entries(workspaceIds)).get(root);
    if (workspaceId === undefined) {
      throw new Error(
        `no workspace id fixture for ${root}, add it to the workspace-id-fixtures recipe`,
      );
    }
    return join(ClaudeCode.SOCKET_DIRECTORY, `${workspaceId}.sock`);
  }
}
