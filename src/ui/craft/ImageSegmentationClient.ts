import type {
  ImagePrompt,
  ImageWorkerRequest,
  ImageWorkerResponse,
  NormalizedImageRect,
  ProbabilityMask,
  SegmentationDiagnostics,
  SegmentationInteractionProfile,
  SegmentationMode,
  SegmentationModelBackendPreference,
  SegmentationProvider,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import type { ImageDataLike } from "./ImagePlacementRecipe";
import { isIOSPlatform } from "./iOSPlatform";
import { createFastPromptMask } from "./PromptMaskProvider";

export { isIOSPlatform } from "./iOSPlatform";

export interface ImageSegmentationResult {
  constraintsSatisfied: boolean;
  diagnostics: SegmentationDiagnostics;
  imageId: string;
  mask: SubjectMask;
  maskId: string;
  probabilityMask: ProbabilityMask;
  provider: SegmentationProvider;
  revision: number;
}

interface PendingSegmentation {
  imageId: string;
  prompts: ImagePrompt[];
  reject: (reason?: unknown) => void;
  resolve: (result: ImageSegmentationResult) => void;
  revision: number;
  subjectBox?: NormalizedImageRect;
}

export interface ImageSegmentationClientOptions {
  mode?: SegmentationMode;
  modelBackend?: SegmentationModelBackendPreference;
  modelBaseUrl?: string;
  onProgress?: (stage: string, progress?: number) => void;
  onProviderChange?: (
    profile: SegmentationInteractionProfile,
    provider?: SegmentationProvider,
    fallbackReason?: string,
  ) => void;
  wasmBaseUrl?: string;
  wasmNumThreads?: number;
  workerFactory?: () => Worker;
}

function localAssetUrl(path: string): string {
  const baseUrl =
    typeof document === "undefined" ? "http://localhost/" : document.baseURI;
  return new URL(path, baseUrl).href;
}

function defaultSegmentationMode(): SegmentationMode {
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("segmentation") === "fast"
  ) {
    return "fast";
  }
  return "auto";
}

function defaultModelBackend(): SegmentationModelBackendPreference {
  return isIOSPlatform(typeof navigator === "undefined" ? undefined : navigator)
    ? "wasm"
    : "auto";
}

interface BufferedImageData extends ImageDataLike {
  data: Uint8ClampedArray;
}

function bufferedImage(image: ImageDataLike): BufferedImageData {
  if (image.data instanceof Uint8ClampedArray) {
    return { data: image.data, height: image.height, width: image.width };
  }
  return {
    data: Uint8ClampedArray.from(image.data),
    height: image.height,
    width: image.width,
  };
}

export class ImageSegmentationClient {
  readonly #mode: SegmentationMode;
  readonly #modelBackend: SegmentationModelBackendPreference;
  readonly #modelBaseUrl: string;
  readonly #onProgress?: (stage: string, progress?: number) => void;
  readonly #onProviderChange?: ImageSegmentationClientOptions["onProviderChange"];
  readonly #wasmBaseUrl: string;
  readonly #wasmNumThreads?: number;
  readonly #workerFactory: () => Worker;
  readonly #workerSupported: boolean;
  #currentImageId?: string;
  #disposed = false;
  #fallbackImage?: ImageDataLike;
  #fallbackPreviousMask?: SubjectMask;
  #imageSequence = 0;
  #latestMaskId?: string;
  #latestRevision = -1;
  #nextRequestId = 1;
  #pending = new Map<number, PendingSegmentation>();
  #worker?: Worker;

  constructor(options: ImageSegmentationClientOptions = {}) {
    this.#mode = options.mode ?? defaultSegmentationMode();
    this.#modelBackend = options.modelBackend ?? defaultModelBackend();
    this.#modelBaseUrl = options.modelBaseUrl ?? localAssetUrl("models/");
    this.#onProgress = options.onProgress;
    this.#onProviderChange = options.onProviderChange;
    this.#wasmBaseUrl = options.wasmBaseUrl ?? localAssetUrl("wasm/");
    this.#wasmNumThreads =
      options.wasmNumThreads ??
      (isIOSPlatform(
        typeof navigator === "undefined" ? undefined : navigator,
      )
        ? 1
        : undefined);
    this.#workerSupported =
      options.workerFactory !== undefined || typeof Worker !== "undefined";
    this.#workerFactory =
      options.workerFactory ??
      (() =>
        new Worker(new URL("./imageSegmentation.worker.ts", import.meta.url), {
          type: "module",
        }));
    this.#onProviderChange?.(this.#mode === "fast" ? "classic" : "model");
  }

  setImage(pixels: ImageDataLike): string {
    this.#assertActive();
    this.cancel();
    if (this.#currentImageId) {
      const disposeRequest: ImageWorkerRequest = {
        imageId: this.#currentImageId,
        type: "dispose-image",
      };
      this.#worker?.postMessage(disposeRequest);
    }
    const imageId = `image-${++this.#imageSequence}`;
    this.#currentImageId = imageId;
    this.#latestMaskId = undefined;
    this.#fallbackPreviousMask = undefined;
    const bufferedPixels = bufferedImage(pixels);
    this.#fallbackImage = bufferedPixels;
    if (!this.#workerSupported) return imageId;
    try {
      this.#worker ??= this.#createWorker();
      const workerPixels = {
        data: Uint8ClampedArray.from(bufferedPixels.data),
        height: bufferedPixels.height,
        width: bufferedPixels.width,
      };
      const request: ImageWorkerRequest = {
        imageId,
        pixels: workerPixels,
        requestId: this.#nextRequestId++,
        type: "set-image",
      };
      this.#worker.postMessage(request, [workerPixels.data.buffer]);
    } catch {
      this.#worker?.terminate();
      this.#worker = undefined;
    }
    return imageId;
  }

  async segment(
    prompts: ImagePrompt[],
    revision: number,
    subjectBox?: NormalizedImageRect,
  ): Promise<ImageSegmentationResult> {
    this.#assertActive();
    const imageId = this.#currentImageId;
    if (!imageId) throw new Error("image-not-set");
    this.#latestRevision = revision;
    if (!this.#worker) {
      return this.#fallbackSegment(prompts, revision, imageId, subjectBox);
    }
    const requestId = this.#nextRequestId++;
    const request: ImageWorkerRequest = {
      imageId,
      previousMaskId: this.#latestMaskId,
      prompts: structuredClone(prompts),
      requestId,
      revision,
      subjectBox: subjectBox ? { ...subjectBox } : undefined,
      type: "segment",
    };
    return new Promise<ImageSegmentationResult>((resolve, reject) => {
      this.#pending.set(requestId, {
        imageId,
        prompts: request.prompts,
        reject,
        resolve,
        revision,
        subjectBox: request.subjectBox,
      });
      this.#worker?.postMessage(request);
    });
  }

  cancel(): void {
    for (const [requestId, pending] of this.#pending) {
      const request: ImageWorkerRequest = {
        imageId: pending.imageId,
        requestId,
        type: "cancel",
      };
      this.#worker?.postMessage(request);
      pending.reject(new DOMException("Segmentation cancelled", "AbortError"));
    }
    this.#pending.clear();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.cancel();
    if (this.#currentImageId) {
      const disposeImageRequest: ImageWorkerRequest = {
        imageId: this.#currentImageId,
        type: "dispose-image",
      };
      this.#worker?.postMessage(disposeImageRequest);
    }
    const request: ImageWorkerRequest = { type: "dispose" };
    this.#worker?.postMessage(request);
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#fallbackImage = undefined;
    this.#fallbackPreviousMask = undefined;
    this.#currentImageId = undefined;
    this.#disposed = true;
  }

  #createWorker(): Worker {
    const worker = this.#workerFactory();
    worker.addEventListener("message", this.#handleMessage);
    worker.addEventListener("error", this.#handleWorkerError);
    const request: ImageWorkerRequest = {
      mode: this.#mode,
      modelBackend: this.#modelBackend,
      modelBaseUrl: this.#modelBaseUrl,
      requestId: this.#nextRequestId++,
      type: "initialize",
      wasmBaseUrl: this.#wasmBaseUrl,
      wasmNumThreads: this.#wasmNumThreads,
    };
    worker.postMessage(request);
    return worker;
  }

  readonly #handleMessage = (
    event: MessageEvent<ImageWorkerResponse>,
  ): void => {
    const response = event.data;
    if (response.type === "progress") {
      if (!response.imageId || response.imageId === this.#currentImageId) {
        this.#onProgress?.(response.stage, response.progress);
      }
      return;
    }
    if (response.type === "embedding-ready") {
      if (response.imageId === this.#currentImageId) {
        this.#notifyProvider(response.provider);
        this.#onProgress?.("embedding-ready", 1);
      }
      return;
    }
    if (response.type === "initialized") {
      if (this.#mode === "fast" || response.provider !== "fast") {
        this.#notifyProvider(response.provider, response.fallbackReason);
      }
      return;
    }
    const pending = this.#pending.get(response.requestId);
    if (!pending) return;
    this.#pending.delete(response.requestId);
    if (response.type === "error") {
      if (response.recoverable) {
        void this.#fallbackSegment(
          pending.prompts,
          pending.revision,
          pending.imageId,
          pending.subjectBox,
          response.code,
        ).then(pending.resolve, pending.reject);
      } else {
        pending.reject(new Error(response.code));
      }
      return;
    }
    if (
      response.imageId !== pending.imageId ||
      response.imageId !== this.#currentImageId ||
      response.revision !== pending.revision ||
      response.revision !== this.#latestRevision
    ) {
      pending.reject(new DOMException("Stale segmentation", "AbortError"));
      return;
    }
    this.#latestMaskId = response.maskId;
    this.#notifyProvider(
      response.diagnostics.provider,
      response.diagnostics.fallbackReason,
    );
    this.#fallbackPreviousMask = {
      data: response.mask.data.slice(),
      height: response.mask.height,
      width: response.mask.width,
    };
    pending.resolve({
      constraintsSatisfied: response.constraintsSatisfied,
      diagnostics: response.diagnostics,
      imageId: response.imageId,
      mask: response.mask,
      maskId: response.maskId,
      probabilityMask: response.probabilityMask,
      provider: response.diagnostics.provider,
      revision: response.revision,
    });
  };

  readonly #handleWorkerError = (): void => {
    this.#worker?.terminate();
    this.#worker = undefined;
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    pending.forEach((item) => {
      void this.#fallbackSegment(
        item.prompts,
        item.revision,
        item.imageId,
        item.subjectBox,
        "worker-crashed",
      ).then(item.resolve, item.reject);
    });
  };

  async #fallbackSegment(
    prompts: ImagePrompt[],
    revision: number,
    imageId: string,
    subjectBox?: NormalizedImageRect,
    fallbackReason?: string,
  ): Promise<ImageSegmentationResult> {
    const image = this.#fallbackImage;
    if (!image || imageId !== this.#currentImageId)
      throw new Error("image-not-set");
    await Promise.resolve();
    if (
      this.#disposed ||
      revision !== this.#latestRevision ||
      imageId !== this.#currentImageId
    ) {
      throw new DOMException("Stale segmentation", "AbortError");
    }
    const result = createFastPromptMask(
      image,
      prompts,
      subjectBox,
      this.#fallbackPreviousMask,
    );
    const maskId = `${imageId}:${revision}:fallback`;
    this.#latestMaskId = maskId;
    this.#fallbackPreviousMask = {
      data: result.mask.data.slice(),
      height: result.mask.height,
      width: result.mask.width,
    };
    this.#notifyProvider(result.provider, fallbackReason);
    return {
      ...result,
      diagnostics: {
        ...result.diagnostics,
        fallbackReason,
      },
      imageId,
      maskId,
      revision,
    };
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error("Segmentation client was disposed.");
  }

  #notifyProvider(
    provider: SegmentationProvider,
    fallbackReason?: string,
  ): void {
    const profile: SegmentationInteractionProfile =
      provider === "slimsam" || provider === "alpha" ? "model" : "classic";
    this.#onProviderChange?.(profile, provider, fallbackReason);
  }
}
