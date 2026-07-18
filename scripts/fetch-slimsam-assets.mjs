import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "Xenova/slimsam-77-uniform";
const revision = "5850ab45f587c112167512ffef949107115e26a0";
const root = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "models",
  "slimsam-77-uniform",
  revision,
);
const wasmRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "wasm",
);
const packageWasmRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "node_modules",
  "onnxruntime-web",
  "dist",
);

const modelFiles = [
  "config.json",
  "preprocessor_config.json",
  "onnx/prompt_encoder_mask_decoder_fp16.onnx",
  "onnx/prompt_encoder_mask_decoder_quantized.onnx",
  "onnx/vision_encoder_fp16.onnx",
  "onnx/vision_encoder_quantized.onnx",
];
const wasmFiles = [
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
];
const expectedAssets = {
  LICENSE: [
    11358,
    "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30",
  ],
  "config.json": [
    379,
    "6339884f168658d3ca6473b486973913fb33e84e625e06ae2dd7b4a808187419",
  ],
  "onnx/prompt_encoder_mask_decoder_fp16.onnx": [
    8550118,
    "df24d49a6f1a5dc0dbbecd84ca0fff9f14c76e63b81fd35c2b92c1321b007f71",
  ],
  "onnx/prompt_encoder_mask_decoder_quantized.onnx": [
    4903810,
    "cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2",
  ],
  "onnx/vision_encoder_fp16.onnx": [
    12170657,
    "11aaeb49c75e7b3f4cbf8a32c2c819406520c6b3affb4068ff474b2240c8aa38",
  ],
  "onnx/vision_encoder_quantized.onnx": [
    8882165,
    "cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971",
  ],
  "preprocessor_config.json": [
    466,
    "225545a743c654e3c495ec6f545a0eaba57c8ba3fbbd8483b3cb1c0fc58db517",
  ],
  "wasm/ort-wasm-simd-threaded.jsep.mjs": [
    44484,
    "08fb86ec433c78bfb032c5d84a68b8e8e5a8d81268fa39e24314179a5767a5b9",
  ],
  "wasm/ort-wasm-simd-threaded.jsep.wasm": [
    21596019,
    "c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39",
  ],
  "wasm/ort-wasm-simd-threaded.mjs": [
    20856,
    "43c25054b6b9ac000f786c65545ff83a45f871e0e310e8c2f4d48a363bb66db4",
  ],
  "wasm/ort-wasm-simd-threaded.wasm": [
    11133407,
    "f061472c6e77d6d50d079aacdc0ff9b63fee287ddd2cbf46cf62438d3891de2b",
  ],
};

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function verify(path, key) {
  const data = await readFile(path);
  const hash = await sha256(path);
  const [size, expectedHash] = expectedAssets[key];
  if (data.byteLength !== size || hash !== expectedHash) {
    throw new Error(`Asset verification failed: ${key}`);
  }
  return { path: key, sha256: hash, size: data.byteLength };
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const temporary = `${destination}.download`;
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
  await rename(temporary, destination);
}

const temporaryRoot = `${root}.download`;
await rm(temporaryRoot, { force: true, recursive: true });
await mkdir(temporaryRoot, { recursive: true });
for (const path of modelFiles) {
  await download(
    `https://huggingface.co/${repository}/resolve/${revision}/${path}`,
    join(temporaryRoot, path),
  );
}
await download(
  "https://www.apache.org/licenses/LICENSE-2.0.txt",
  join(temporaryRoot, "LICENSE"),
);

for (const path of [...modelFiles, "LICENSE"]) {
  await verify(join(temporaryRoot, path), path);
}

await mkdir(wasmRoot, { recursive: true });
for (const path of wasmFiles) {
  await verify(join(packageWasmRoot, path), `wasm/${path}`);
}

const files = [];
for (const path of [...modelFiles, "LICENSE"]) {
  const absolute = join(temporaryRoot, path);
  const data = await readFile(absolute);
  files.push({ path, sha256: await sha256(absolute), size: data.byteLength });
}
for (const path of wasmFiles) {
  const absolute = join(packageWasmRoot, path);
  const data = await readFile(absolute);
  files.push({
    path: `../../../wasm/${path}`,
    sha256: await sha256(absolute),
    size: data.byteLength,
    source: "onnxruntime-web@1.22.0-dev.20250409-89f8206ba4",
  });
}

await writeFile(
  join(temporaryRoot, "manifest.json"),
  `${JSON.stringify(
    {
      files,
      license: "Apache-2.0",
      modelFormats: { wasm: "q8", webgpu: "fp16" },
      repository,
      revision,
      transformersJs: "3.8.1",
    },
    null,
    2,
  )}\n`,
);

await rm(root, { force: true, recursive: true });
await rename(temporaryRoot, root);
for (const path of wasmFiles) {
  await copyFile(join(packageWasmRoot, path), join(wasmRoot, path));
}

console.log(
  `Fetched ${repository}@${revision} and wrote ${files.length} verified assets.`,
);
