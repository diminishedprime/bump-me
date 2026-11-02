import { inject, injectable } from "tsyringe";
import * as z from "zod/mini";
import { Fs } from "#src/fs";

const AiTitleSchema = z.object({
  type: z.literal("ai-title"),
  aiTitle: z.string(),
});
const CustomTitleSchema = z.object({
  type: z.literal("custom-title"),
  customTitle: z.string(),
});
const TitleSchema = z.discriminatedUnion("type", [
  AiTitleSchema,
  CustomTitleSchema,
]);

@injectable()
export class ClaudeTranscript {
  constructor(@inject(Fs) private readonly fs: Fs) {}

  async title(path: string) {
    let aiTitle: string | undefined;
    let aiTitleStart: number | undefined;
    let lineStart = 0;
    let lineEnd = 0;
    for await (const line of this.fs.lines(path)) {
      lineStart = lineEnd;
      lineEnd += Buffer.byteLength(line) + 1;
      if (!line.includes('"ai-title"') && !line.includes('"custom-title"')) {
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch {
        continue;
      }
      const parsed = TitleSchema.safeParse(json);
      if (!parsed.success) {
        continue;
      }
      if (parsed.data.type === "custom-title") {
        return {
          kind: "custom",
          customTitle: parsed.data.customTitle,
        } as const;
      }
      aiTitle = parsed.data.aiTitle;
      aiTitleStart = lineStart;
    }
    return {
      kind: "untitled",
      aiTitle,
      scanned: aiTitleStart ?? lineStart,
    } as const;
  }

  async aiTitle(path: string, from: number) {
    let lineStart = from;
    let lineEnd = from;
    for await (const line of this.fs.lines(path, from)) {
      lineStart = lineEnd;
      lineEnd += Buffer.byteLength(line) + 1;
      if (!line.includes('"ai-title"')) {
        continue;
      }
      let json: unknown;
      try {
        json = JSON.parse(line);
      } catch {
        continue;
      }
      const parsed = AiTitleSchema.safeParse(json);
      if (parsed.success) {
        return { aiTitle: parsed.data.aiTitle, scanned: lineStart };
      }
    }
    return { aiTitle: undefined, scanned: lineStart };
  }
}
