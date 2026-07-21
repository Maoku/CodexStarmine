import type {
  ImageWorkerRequest,
  ImageWorkerResponse,
  PromptMaskProvider,
  SegmentationMode,
  SegmentationModelBackendPreference,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import type { ImageDataLike } from "./ImagePlacementRecipe";
import { selectMaskCandidate } from "./MaskCandidateSelector";
import {
  createFastPromptMask,
  hasUsefulImageAlpha,
  type PromptMaskResult,
} from "./PromptMaskProvider";
import {
  SLIMSAM_MODEL_REVISION,
  SlimSamPromptMaskProvider,
} from "./SlimSamPromptMaskProvider";
import { postprocessProbabilityMask } from "./SubjectMaskPostprocessor";

interface WorkerScope {
  close(): void;
  onmessage: ((event: MessageEvent<ImageWorkerRequest>) => void) | null;
  postMessage(message: ImageWorkerResponse, transfer?: Transferable[]): void;
}

interface WorkerImage {
  id: string;
  pixels: ImageDataLike & { data: Uint8ClampedArray };
  usefulAlpha: boolean;
}

const scope = self as unknown as WorkerScope;
let image: WorkerImage | undefined;
let mode: SegmentationMode = "auto";
let modelBackend: SegmentationModelBackendPreference = "auto";
let modelBaseUrl = "";
let wasmBaseUrl = "";
let wasmNumThreads: number | undefined;
let provider: PromptMaskProvider | undefined;
let providerFallbackReason: string | undefined;
let encodeDurationMs: number | undefined;
const cancelled = new Set<number>();
const masks = new Map<string, SubjectMask>();
const MODEL_INITIALIZATION_TIMEOUT_MS = 30_000;
const IMAGE_ENCODING_TIMEOUT_MS = 30_000;
const MASK_DECODING_TIMEOUT_MS = 15_000;

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  code: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(code)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

function progress(
  requestId: number,
  stage: string,
  value?: number,
  imageId?: string,
): void {
  scope.postMessage({
    imageId,
    progress: value,
    requestId,
    stage,
    type: "progress",
  });
}

function rememberMask(maskId: string, mask: SubjectMask): void {
  masks.set(maskId, {
    data: mask.data.slice(),
    height: mask.height,
    width: mask.width,
  });
  while (masks.size > 4) masks.delete(masks.keys().next().value as string);
}

function disposeImage(imageId?: string): void {
  if (!imageId || image?.id === imageId) {
    image = undefined;
    provider?.disposeImage();
    encodeDurationMs = undefined;
  }
  masks.clear();
}

function appendFallbackReason(reason: string): void {
  providerFallbackReason = providerFallbackReason
    ? `${providerFallbackReason};${reason}`
    : reason;
}

async function createSlimSamProvider(
  backend: "webgpu" | "wasm",
  requestId: number,
  imageId: string,
): Promise<PromptMaskProvider> {
  const candidate = new SlimSamPromptMaskProvider({
    backend,
    modelBaseUrl,
    onProgress: (stage, value) => progress(requestId, stage, value, imageId),
    wasmBaseUrl,
    wasmNumThreads,
  });
  try {
    await withTimeout(
      candidate.initialize(),
      MODEL_INITIALIZATION_TIMEOUT_MS,
      `${backend}-model-initialization-timeout`,
    );
    return candidate;
  } catch (error) {
    candidate.dispose();
    throw error;
  }
}

async function encodeWithProvider(
  activeProvider: PromptMaskProvider,
  requestId: number,
): Promise<void> {
  if (!image) throw new Error("image-not-set");
  const startedAt = performance.now();
  await withTimeout(
    activeProvider.setImage({
      imageId: image.id,
      pixels: image.pixels.data,
      sourceHeight: image.pixels.height,
      sourceWidth: image.pixels.width,
    }),
    IMAGE_ENCODING_TIMEOUT_MS,
    `${activeProvider.backend}-image-encode-timeout`,
  );
  encodeDurationMs = performance.now() - startedAt;
  if (cancelled.has(requestId)) activeProvider.disposeImage();
}

async function activateSlimSam(requestId: number): Promise<void> {
  if (!image || image.usefulAlpha || mode !== "auto") return;
  providerFallbackReason = undefined;
  if (provider) {
    try {
      await encodeWithProvider(provider, requestId);
      return;
    } catch {
      appendFallbackReason(`${provider.backend}-image-encode-failed`);
      const failedBackend = provider.backend;
      provider.dispose();
      provider = undefined;
      if (failedBackend === "wasm") return;
    }
  }
  if (modelBackend === "wasm") {
    try {
      provider = await createSlimSamProvider("wasm", requestId, image.id);
      await encodeWithProvider(provider, requestId);
    } catch {
      provider?.dispose();
      provider = undefined;
      appendFallbackReason("wasm-initialization-or-warmup-failed");
    }
    return;
  }
  try {
    provider = await createSlimSamProvider("webgpu", requestId, image.id);
    await encodeWithProvider(provider, requestId);
    return;
  } catch {
    provider?.dispose();
    provider = undefined;
    appendFallbackReason("webgpu-initialization-or-warmup-failed");
  }
  try {
    provider = await createSlimSamProvider("wasm", requestId, image.id);
    await encodeWithProvider(provider, requestId);
  } catch {
    provider?.dispose();
    provider = undefined;
    appendFallbackReason("wasm-initialization-or-warmup-failed");
  }
}

async function downgradeToWasm(requestId: number): Promise<boolean> {
  if (!image || provider?.backend !== "webgpu") return false;
  provider.dispose();
  provider = undefined;
  appendFallbackReason("webgpu-decode-failed");
  try {
    provider = await createSlimSamProvider("wasm", requestId, image.id);
    await encodeWithProvider(provider, requestId);
    return true;
  } catch {
    provider?.dispose();
    provider = undefined;
    appendFallbackReason("wasm-initialization-or-warmup-failed");
    return false;
  }
}

async function segmentWithSlimSam(
  request: Extract<ImageWorkerRequest, { type: "segment" }>,
): Promise<PromptMaskResult> {
  if (!image || !provider) throw new Error("slimsam-not-ready");
  const startedAt = performance.now();
  const candidates = await withTimeout(
    provider.decodeCandidates({
      prompts: request.prompts,
      subjectBox: request.subjectBox,
    }),
    MASK_DECODING_TIMEOUT_MS,
    `${provider.backend}-mask-decode-timeout`,
  );
  const previousMask = request.previousMaskId
    ? masks.get(request.previousMaskId)
    : undefined;
  const selection = selectMaskCandidate(candidates, {
    image: image.pixels,
    previousMask,
    prompts: request.prompts,
    subjectBox: request.subjectBox,
  });
  const processed = postprocessProbabilityMask(
    selection.candidate.probabilityMask,
    request.prompts,
    {
      subjectBox: request.subjectBox,
      threshold: selection.threshold,
    },
  );
  return {
    constraintsSatisfied: processed.constraintsSatisfied,
    diagnostics: {
      backend: provider.backend,
      candidateScores: selection.scores,
      constraintRepairApplied: processed.constraintRepairApplied,
      decodeDurationMs: performance.now() - startedAt,
      encodeDurationMs,
      fallbackReason: providerFallbackReason,
      inputEdge: Math.max(image.pixels.width, image.pixels.height),
      localRefinementCount: 0,
      peakWorkingBytesEstimate:
        image.pixels.data.byteLength +
        candidates.reduce(
          (total, candidate) =>
            total + candidate.probabilityMask.data.byteLength,
          0,
        ) +
        processed.mask.data.byteLength,
      provider: "slimsam",
      selectedCandidate: selection.candidate.index,
      selectedThreshold: selection.threshold,
    },
    mask: processed.mask,
    probabilityMask: selection.candidate.probabilityMask,
    provider: "slimsam",
  };
}

async function handleInitialize(
  request: Extract<ImageWorkerRequest, { type: "initialize" }>,
): Promise<void> {
  mode = request.mode;
  modelBackend = request.modelBackend;
  modelBaseUrl = request.modelBaseUrl;
  wasmBaseUrl = request.wasmBaseUrl;
  wasmNumThreads = request.wasmNumThreads;
  scope.postMessage({
    backend: "cpu",
    modelVersion: SLIMSAM_MODEL_REVISION,
    provider: "fast",
    requestId: request.requestId,
    type: "initialized",
  });
}

async function handleSetImage(
  request: Extract<ImageWorkerRequest, { type: "set-image" }>,
): Promise<void> {
  disposeImage();
  providerFallbackReason = undefined;
  progress(request.requestId, "decoding", 0, request.imageId);
  try {
    const pixelData = {
      data: request.pixels.data,
      height: request.pixels.height,
      width: request.pixels.width,
    };
    image = {
      id: request.imageId,
      pixels: pixelData,
      usefulAlpha: hasUsefulImageAlpha(pixelData),
    };
    if (!image.usefulAlpha) await activateSlimSam(request.requestId);
    if (cancelled.delete(request.requestId)) return;
    scope.postMessage({
      backend: image.usefulAlpha ? "none" : (provider?.backend ?? "cpu"),
      imageId: request.imageId,
      inputEdge: Math.max(pixelData.width, pixelData.height),
      provider: image.usefulAlpha ? "alpha" : (provider?.provider ?? "fast"),
      requestId: request.requestId,
      type: "embedding-ready",
    });
  } catch {
    image = undefined;
    scope.postMessage({
      code: "image-decode-failed",
      imageId: request.imageId,
      recoverable: true,
      requestId: request.requestId,
      type: "error",
    });
  }
}

async function handleSegment(
  request: Extract<ImageWorkerRequest, { type: "segment" }>,
): Promise<void> {
  if (!image || image.id !== request.imageId) {
    scope.postMessage({
      code: image ? "stale-image" : "image-not-set",
      imageId: request.imageId,
      recoverable: true,
      requestId: request.requestId,
      type: "error",
    });
    return;
  }
  if (cancelled.delete(request.requestId)) return;
  progress(request.requestId, "segmenting", 0, request.imageId);
  const fastResult = createFastPromptMask(
    image.pixels,
    request.prompts,
    request.subjectBox,
    request.previousMaskId ? masks.get(request.previousMaskId) : undefined,
  );
  let result = fastResult;
  if (!image.usefulAlpha && mode === "auto" && provider) {
    try {
      result = await segmentWithSlimSam(request);
    } catch {
      if (await downgradeToWasm(request.requestId)) {
        try {
          result = await segmentWithSlimSam(request);
        } catch {
          provider?.dispose();
          provider = undefined;
          appendFallbackReason("wasm-decode-failed");
        }
      } else if (provider?.backend === "wasm") {
        provider.dispose();
        provider = undefined;
        appendFallbackReason("wasm-decode-failed");
      }
    }
  }
  if (cancelled.delete(request.requestId)) return;
  if (result.provider === "fast" && providerFallbackReason) {
    result = {
      ...result,
      diagnostics: {
        ...result.diagnostics,
        fallbackReason: providerFallbackReason,
      },
    };
  }
  const maskId = `${request.imageId}:${request.revision}:${request.requestId}`;
  rememberMask(maskId, result.mask);
  const response: ImageWorkerResponse = {
    constraintsSatisfied: result.constraintsSatisfied,
    diagnostics: result.diagnostics,
    imageId: request.imageId,
    mask: result.mask,
    maskId,
    probabilityMask: result.probabilityMask,
    requestId: request.requestId,
    revision: request.revision,
    type: "segmentation",
  };
  scope.postMessage(response, [
    result.mask.data.buffer,
    result.probabilityMask.data.buffer,
  ]);
}

async function handleRequest(request: ImageWorkerRequest): Promise<void> {
  if (request.type === "initialize") {
    await handleInitialize(request);
  } else if (request.type === "set-image") {
    await handleSetImage(request);
  } else if (request.type === "segment") {
    await handleSegment(request);
  } else if (request.type === "dispose-image") {
    disposeImage(request.imageId);
  } else if (request.type === "dispose") {
    disposeImage();
    provider?.dispose();
    provider = undefined;
    scope.close();
  }
}

let queue = Promise.resolve();
scope.onmessage = (event): void => {
  const request = event.data;
  if (request.type === "cancel") {
    cancelled.add(request.requestId);
    return;
  }
  queue = queue.then(() => handleRequest(request)).catch(() => undefined);
};
