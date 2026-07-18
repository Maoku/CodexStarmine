import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const revision = "5850ab45f587c112167512ffef949107115e26a0";
const root = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "models",
  "slimsam-77-uniform",
  revision,
);
const manifest = JSON.parse(
  await readFile(join(root, "manifest.json"), "utf8"),
);

if (manifest.revision !== revision) {
  throw new Error(`Unexpected SlimSAM revision: ${manifest.revision}`);
}
for (const file of manifest.files) {
  const path = resolve(root, file.path);
  const metadata = await stat(path);
  const hash = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  if (metadata.size !== file.size || hash !== file.sha256) {
    throw new Error(`SlimSAM asset verification failed: ${file.path}`);
  }
}

console.log(`Verified ${manifest.files.length} SlimSAM assets at ${revision}.`);
