import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  mkdir,
  mkdtempDisposable,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { map, type TraverseContext } from "neotraverse";
import { z } from "zod";

const EVENTS = [
  ["SessionStart", "session-start"],
  ["UserPromptSubmit", "user-prompt-submit"],
  ["Stop", "stop"],
  ["PermissionRequest", "permission-request"],
] as const;
interface Capture {
  folder: string;
  mode: string;
  name?: string;
}
const CAPTURES: Capture[] = [
  { folder: "accept-edits", mode: "acceptEdits" },
  { folder: "named", mode: "acceptEdits", name: "Named capture session" },
];
const UNUSED_TOOLS = [
  "CronCreate",
  "CronDelete",
  "CronList",
  "DesignSync",
  "EnterWorktree",
  "ExitWorktree",
  "Monitor",
  "NotebookEdit",
  "PushNotification",
  "RemoteTrigger",
  "SendMessage",
  "TaskStop",
  "WebFetch",
  "WebSearch",
];

const CapturedSchema = z.looseObject({
  session_id: z.string(),
  prompt_id: z.string(),
  scratchpad_dir: z.string(),
  transcript_path: z.string(),
});

type Captured = z.infer<typeof CapturedSchema>;

const AI_TITLE = "Remove the capture file";
const ASSISTANT_REPLY = "<assistant-reply>";
const AssistantSchema = z.looseObject({ type: z.literal("assistant") });
const SkillListingSchema = z.looseObject({ type: z.literal("skill_listing") });
const ASSISTANT_TEXT = /^message\.content\.\d+\.text$/;
const CLAUDE_EMAIL = z
  .string({
    error: "set CLAUDE_EMAIL to the email Claude Code is signed in as",
  })
  .parse(process.env["CLAUDE_EMAIL"]);
const NUMBERED = [
  ["uuid", /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi],
  ["hash", /\b(?=[0-9]*[a-f])(?:[0-9a-f]{64}|[0-9a-f]{16})\b/g],
  ["msg", /\bmsg_[A-Za-z0-9]+/g],
  ["req", /\breq_[A-Za-z0-9]+/g],
  ["toolu", /\btoolu_[A-Za-z0-9]+/g],
] as const;
const TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;
const NAMED = [
  ["\nYou are an agent working with the user", "system-prompt-identity"],
  ["Write code that reads like the surrounding code", "system-prompt-guidance"],
  ["The reasoning effort setting", "system-prompt-effort"],
  ["# Memory", "system-prompt-memory"],
  [
    "To make a small change to a page you already published",
    "system-prompt-artifacts",
  ],
  ["# Session-specific guidance", "system-prompt-session-guidance"],
  ["# Environment\n - The most recent Claude models", "system-prompt-models"],
  ["For actions that are hard to reverse", "system-prompt-confirm-actions"],
  ["When you use a pronoun", "system-prompt-pronouns"],
  ["# Context management", "system-prompt-context-management"],
  ["When you have enough information to act", "system-prompt-act"],
  ["# Environment\nYou have been invoked", "environment-reminder"],
  ["Available agent types", "agent-listing-reminder"],
  ["Attribution for git commits", "attribution-reminder"],
  ["As you answer the user's questions", "user-context-reminder"],
  ["The user's email address is", "user-email-context"],
  ["The following skills are available", "skill-listing-reminder"],
  ["The following deferred tools", "deferred-tools-reminder"],
  ["You are powered by the model named", "model-reminder"],
  ["Today's date is", "date-reminder"],
  ["<total_tokens>", "total-tokens-reminder"],
] as const;
const SYSTEM_REMINDER = "<system-reminder>\n";
const VOLATILE_NUMBER =
  /(input|output|thinking)_?tokens$|USD$|duration|^startTime$/i;
const ToolSchema = z.union([
  z.looseObject({ name: z.string(), input_schema: z.looseObject({}) }),
  z.looseObject({
    name: z.string(),
    schema: z.looseObject({ input_schema: z.looseObject({}) }),
  }),
]);
const AGENT_LINE = /^- ([^:]+):/;

const reported = new Set<string>();

const indented = (text: string) =>
  text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

function replaced(what: string, from: string, to: string) {
  const report = [
    `  replaced ${what}`,
    indented(from),
    "  with",
    indented(to),
  ].join("\n");
  if (!reported.has(report)) {
    reported.add(report);
    console.log(report);
  }
  return to;
}

const named = (text: string) =>
  NAMED.find(([prefix]) =>
    text.replace(SYSTEM_REMINDER, "").startsWith(prefix),
  )?.[1];

class Numbering {
  private readonly placeholders = new Map<string, string>();
  private readonly counts = new Map<string, number>();

  replace(text: string) {
    return NUMBERED.reduce(
      (text, [kind, pattern]) =>
        text.replaceAll(pattern, (value) => this.placeholder(kind, value)),
      text,
    ).replaceAll(TIMESTAMP, () => this.next("timestamp"));
  }

  private next(kind: string) {
    const count = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, count);
    return `<${kind}-${String(count)}>`;
  }

  private placeholder(kind: string, value: string) {
    const existing = this.placeholders.get(value);
    if (existing !== undefined) {
      return existing;
    }
    const placeholder = this.next(kind);
    this.placeholders.set(value, placeholder);
    return placeholder;
  }
}

const fixtures = join(import.meta.dirname, "..", "test", "fixtures", "hooks");

const workspacePrefix = () => join(tmpdir(), "bump-me-");
const capturesPrefix = () => join(tmpdir(), "bump-me-captures-");
const workspaceSlug = (workspace: string) =>
  workspace.replaceAll(/[^A-Za-z0-9]/g, "-");
const claudeTmp = (scratchpad: string) => dirname(dirname(dirname(scratchpad)));
const claudeDirectory = (workspace: string) => join(workspace, ".claude");
const settingsPath = (workspace: string) =>
  join(claudeDirectory(workspace), "settings.json");
const capturePath = (captures: string, name: string) =>
  join(captures, `${name}.json`);
const fixtureDirectory = (folder: string) => join(fixtures, folder);
const fixturePath = (folder: string, name: string) =>
  join(fixtureDirectory(folder), `${name}.json`);
const transcriptFixturePath = (folder: string) =>
  join(fixtureDirectory(folder), "transcript.json");

async function createDirectories(workspace: string, folder: string) {
  await mkdir(claudeDirectory(workspace));
  await mkdir(fixtureDirectory(folder), { recursive: true });
}

const claudeSettings = (captures: string) => ({
  hooks: Object.fromEntries(
    EVENTS.map(([event, name]) => [
      event,
      [
        {
          hooks: [
            {
              type: "command",
              command: `cat > ${capturePath(captures, name)}`,
            },
          ],
        },
      ],
    ]),
  ),
});

async function runClaude(
  workspace: string,
  mode: string,
  name: string | undefined,
) {
  const naming = name === undefined ? [] : ["--name", name];
  const claude = spawn(
    "claude",
    [
      "-p",
      "--setting-sources",
      "project",
      "--settings",
      JSON.stringify({
        disableClaudeAiConnectors: true,
        disableBundledSkills: true,
      }),
      "--disallowedTools",
      ...UNUSED_TOOLS,
      "--permission-mode",
      mode,
      ...naming,
      "--model",
      "haiku",
      "Run the bash command: rm /tmp/bump-me-capture",
    ],
    { cwd: workspace, stdio: ["ignore", "pipe", "inherit"] },
  );
  const closed = once(claude, "close");
  console.log(`claude --permission-mode ${mode} ${naming.join(" ")}:`);
  for await (const line of createInterface({ input: claude.stdout })) {
    console.log(`  ${line}`);
  }
  await closed;
  if (claude.exitCode !== 0) {
    throw new Error(`claude exited with ${String(claude.exitCode)}`);
  }
  console.log();
}

const replaceAll = (text: string, [from, to]: readonly [string, string]) =>
  text.replaceAll(from, to);

// Best effort approach to try and remove the parts that the llm creates via
// inference or is otherwise just messy.
class Scrubber {
  private readonly placeholders: readonly (readonly [string, string])[];

  constructor(
    workspace: string,
    captures: string,
    { session_id, prompt_id, scratchpad_dir }: Captured,
  ) {
    this.placeholders = [
      [captures, "<captures>"],
      [workspace, "<workspace>"],
      [workspaceSlug(workspace), "<workspace-slug>"],
      [homedir(), "<home>"],
      [claudeTmp(scratchpad_dir), "<claude-tmp>"],
      [session_id, "<session_id>"],
      [prompt_id, "<prompt_id>"],
      [CLAUDE_EMAIL, "<email>"],
    ];
  }

  scrub(value: unknown): unknown {
    const assistant = AssistantSchema.safeParse(value).success;
    return map(value, (ctx, value) => {
      const replacement =
        Scrubber.byKey(ctx, value) ?? this.byValue(ctx, value, assistant);
      if (replacement !== undefined) {
        ctx.update(replacement);
      }
    });
  }

  private static byKey(ctx: TraverseContext, value: unknown) {
    switch (ctx.key) {
      case "last_assistant_message":
      case "description":
      case "organizationUuid":
      case "signature":
        return `<${ctx.key}>`;
      case "aiTitle":
        return typeof value === "string"
          ? replaced("aiTitle", value, AI_TITLE)
          : undefined;
      case "content":
        return SkillListingSchema.safeParse(ctx.parent?.node).success
          ? "<skill-listing-reminder>"
          : undefined;
      case "names":
        return SkillListingSchema.safeParse(ctx.parent?.node).success
          ? "<skill-names>"
          : undefined;
    }
    if (
      typeof value === "number" &&
      typeof ctx.key === "string" &&
      VOLATILE_NUMBER.test(ctx.key)
    ) {
      return 0;
    }
    return undefined;
  }

  private byValue(ctx: TraverseContext, value: unknown, assistant: boolean) {
    switch (typeof value) {
      case "string":
        return this.string(ctx, value, assistant);
      case "object": {
        const tool = ToolSchema.safeParse(value);
        return tool.success ? `<tool:${tool.data.name}>` : undefined;
      }
      default:
        return undefined;
    }
  }

  private string(ctx: TraverseContext, value: string, assistant: boolean) {
    if (assistant && ASSISTANT_TEXT.test(ctx.path.join("."))) {
      return replaced("assistant reply", value, ASSISTANT_REPLY);
    }
    const name = named(value);
    if (name !== undefined) {
      return `<${name}>`;
    }
    const agent = AGENT_LINE.exec(value)?.[1];
    if (ctx.parent?.key === "addedLines" && agent !== undefined) {
      return `<agent:${agent}>`;
    }
    return this.placeholders.reduce(replaceAll, value);
  }
}

async function capture(folder: string, mode: string, name: string | undefined) {
  reported.clear();
  await using workspaceDirectory = await mkdtempDisposable(workspacePrefix());
  await using captures = await mkdtempDisposable(capturesPrefix());
  const workspace = await realpath(workspaceDirectory.path);
  await createDirectories(workspace, folder);
  await writeFile(
    settingsPath(workspace),
    JSON.stringify(claudeSettings(captures.path)),
  );

  await runClaude(workspace, mode, name);

  const stop = await readCapture(captures.path, "stop");
  const scrubber = new Scrubber(workspace, captures.path, stop);
  const numbering = new Numbering();
  for (const [, name] of EVENTS) {
    const captured = await readPayload(captures.path, name);
    await writeFile(
      fixturePath(folder, name),
      numbering.replace(JSON.stringify(scrubber.scrub(captured))),
    );
  }
  await writeTranscript(scrubber, numbering, folder, stop.transcript_path);
}

async function readPayload(captures: string, name: string): Promise<unknown> {
  return JSON.parse(await readFile(capturePath(captures, name), "utf8"));
}

async function readCapture(captures: string, name: string) {
  return CapturedSchema.parse(await readPayload(captures, name));
}

async function writeTranscript(
  scrubber: Scrubber,
  numbering: Numbering,
  folder: string,
  transcriptPath: string,
) {
  const lines = (await readFile(transcriptPath, "utf8"))
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => scrubber.scrub(JSON.parse(line)));
  await writeFile(
    transcriptFixturePath(folder),
    numbering.replace(JSON.stringify(lines)),
  );
}

for (const { folder, mode, name } of CAPTURES) {
  await capture(folder, mode, name);
}
