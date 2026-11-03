import { Writable } from "node:stream";
import semanticRelease from "semantic-release";

async function run(dryRun: boolean) {
  const result = await semanticRelease(
    { ci: false, dryRun },
    {
      stdout: new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      }) as unknown as NodeJS.WriteStream,
      stderr: process.stderr,
    },
  );

  if (result === false) {
    console.log("No relevant changes, nothing to release.");
    return;
  }

  const {
    nextRelease: { version, type, notes },
    releases,
  } = result;

  if (dryRun) {
    console.log(`Would release ${version} (${type})`);
  } else {
    console.log(`Released ${version} (${type})`);
  }
  for (const { url } of releases) {
    if (url !== undefined) {
      console.log(url);
    }
  }
  if (notes !== undefined) {
    console.log(`\n${notes}`);
  }
}

await run(process.argv.includes("--dry-run"));
