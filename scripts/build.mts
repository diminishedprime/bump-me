import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import { build } from "esbuild";

const run = promisify(execFile);

await rm("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  platform: "node",
  format: "cjs",
  mainFields: ["module", "main"],
  external: ["vscode"],
  outfile: "dist/main.js",
});

await run("sips", [
  "-s",
  "format",
  "png",
  "-z",
  "256",
  "256",
  "assets/bell.svg",
  "--out",
  "dist/icon.png",
]);
