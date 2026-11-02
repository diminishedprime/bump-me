import { inject, injectable } from "tsyringe";
import * as z from "zod/mini";
import { ClaudeTranscript } from "#src/di/claude/transcript";
import { Logger } from "#src/di/logger";
import { Notifier } from "#src/di/notifier";
import { SessionIdSchema, Store } from "#src/di/store";
import { HookSocket } from "#src/hook-socket";

const SessionStartSchema = z.object({
  hook_event_name: z.literal("SessionStart"),
});
const UserPromptSubmitSchema = z.object({
  hook_event_name: z.literal("UserPromptSubmit"),
  session_id: SessionIdSchema,
  session_title: z.optional(z.string()),
});
const SessionTranscriptSchema = z.object({
  session_id: SessionIdSchema,
  transcript_path: z.string(),
});
const StopSchema = z.extend(SessionTranscriptSchema, {
  hook_event_name: z.literal("Stop"),
});
const PermissionRequestSchema = z.extend(SessionTranscriptSchema, {
  hook_event_name: z.literal("PermissionRequest"),
  tool_name: z.string(),
  tool_input: z.object({
    description: z.catch(z.optional(z.string()), undefined),
  }),
});
const HookPayloadSchema = z.discriminatedUnion("hook_event_name", [
  SessionStartSchema,
  UserPromptSubmitSchema,
  StopSchema,
  PermissionRequestSchema,
]);
type UserPromptSubmit = z.infer<typeof UserPromptSubmitSchema>;
type SessionTranscript = z.infer<typeof SessionTranscriptSchema>;

@injectable()
export class ClaudeHooks {
  constructor(
    @inject(HookSocket) private readonly socket: HookSocket,
    @inject(Logger) private readonly logger: Logger,
    @inject(Notifier) private readonly notifier: Notifier,
    @inject(Store) private readonly store: Store,
    @inject(ClaudeTranscript) private readonly transcript: ClaudeTranscript,
  ) {}

  async start() {
    const socket = this.store.socketFile;
    if (socket === undefined) {
      this.logger.warn("no workspace id, so not listening for Claude hooks");
      return;
    }
    this.logger.info(`listening for Claude hooks on ${socket}`);
    await this.socket.listen(
      socket,
      async (payload) => {
        await this.receive(payload);
      },
      (error) => {
        this.logger.error("Claude hook socket failed", error);
      },
    );
  }

  private async receive(payload: string) {
    try {
      const hook = HookPayloadSchema.parse(JSON.parse(payload));
      this.logger.trace("Claude hook", hook);
      switch (hook.hook_event_name) {
        case "SessionStart":
          break;
        case "UserPromptSubmit":
          this.rememberTitle(hook);
          break;
        case "Stop":
          await this.notifier.ring(
            "Finished turn",
            async () => this.title(hook),
            "Click to return to VS Code",
          );
          break;
        case "PermissionRequest":
          await this.notifier.ring(
            "Permission request",
            async () => this.title(hook),
            hook.tool_input.description ??
              `Claude wants to use ${hook.tool_name}`,
          );
          break;
      }
    } catch (error) {
      this.logger.error("Claude hook failed", error);
    }
  }

  private rememberTitle({ session_id, session_title }: UserPromptSubmit) {
    if (session_title === undefined) {
      this.store.rememberUntitled(session_id);
    } else {
      this.store.rememberCustomTitle(session_id, session_title);
    }
  }

  private async title({ session_id, transcript_path }: SessionTranscript) {
    const known = this.store.knownTitle(session_id);
    switch (known.kind) {
      case "unseen": {
        const found = await this.transcript.title(transcript_path);
        if (found.kind === "custom") {
          this.store.rememberCustomTitle(session_id, found.customTitle);
          return found.customTitle;
        }
        this.store.rememberUntitled(session_id, found.scanned);
        return found.aiTitle;
      }
      case "untitled": {
        const { aiTitle, scanned } = await this.transcript.aiTitle(
          transcript_path,
          known.scanned,
        );
        this.store.rememberUntitled(session_id, scanned);
        return aiTitle;
      }
      case "custom":
        return known.customTitle;
    }
  }
}
