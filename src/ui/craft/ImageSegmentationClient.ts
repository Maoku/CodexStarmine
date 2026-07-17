import type {
  GuidedMaskProvider,
  ImagePrompt,
  ImageWorkerRequest,
  ImageWorkerResponse,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import type { ImageDataLike } from "./ImagePlacementRecipe";
import { createFastPromptMask } from "./PromptMaskProvider";

export interface ImageSegmentationResult {
  mask: SubjectMask;
  provider: GuidedMaskProvider;
  revision: number;
}

interface PendingSegmentation {
  prompts: ImagePrompt[];
  reject: (reason?: unknown) => void;
  resolve: (result: ImageSegmentationResult) => void;
  revision: number;
}

export interface ImageSegmentationClientOptions {
  onProgress?: (stage: string, progress?: number) => void;
  workerFactory?: () => Worker;
}

function cloneImage(image: ImageDataLike): ImageDataLike {
  return {
    data: Uint8ClampedArray.from(image.data),
    height: image.height,
    width: image.width,
  };
}

export class ImageSegmentationClient {
  readonly #onProgress?: (stage: string, progress?: number) => void;
  readonly #workerFactory: () => Worker;
  readonly #workerSupported: boolean;
  #disposed = false;
  #fallbackImage?: ImageDataLike;
  #latestRevision = -1;
  #nextRequestId = 1;
  #pending = new Map<number, PendingSegmentation>();
  #worker?: Worker;

  constructor(options: ImageSegmentationClientOptions = {}) {
    this.#onProgress = options.onProgress;
    this.#workerSupported =
      options.workerFactory !== undefined || typeof Worker !== "undefined";
    this.#workerFactory =
      options.workerFactory ??
      (() =>
        new Worker(new URL("./imageSegmentation.worker.ts", import.meta.url), {
          type: "module",
        }));
  }

  setImage(bitmap: ImageBitmap | undefined, pixels: ImageDataLike): void {
    this.#assertActive();
    this.#fallbackImage = cloneImage(pixels);
    this.cancel();
    if (!bitmap || !this.#workerSupported) return;
    try {
      this.#worker ??= this.#createWorker();
      const request: ImageWorkerRequest = {
        image: bitmap,
        requestId: this.#nextRequestId++,
        type: "set-image",
      };
      this.#worker.postMessage(request, [bitmap]);
    } catch {
      this.#worker?.terminate();
      this.#worker = undefined;
    }
  }

  async segment(
    prompts: ImagePrompt[],
    revision: number,
  ): Promise<ImageSegmentationResult> {
    this.#assertActive();
    this.#latestRevision = revision;
    if (!this.#worker) return this.#fallbackSegment(prompts, revision);
    const requestId = this.#nextRequestId++;
    const request: ImageWorkerRequest = {
      prompts: structuredClone(prompts),
      requestId,
      revision,
      type: "segment",
    };
    return new Promise<ImageSegmentationResult>((resolve, reject) => {
      this.#pending.set(requestId, {
        prompts: request.prompts,
        reject,
        resolve,
        revision,
      });
      this.#worker?.postMessage(request);
    });
  }

  cancel(): void {
    for (const [requestId, pending] of this.#pending) {
      const request: ImageWorkerRequest = { requestId, type: "cancel" };
      this.#worker?.postMessage(request);
      pending.reject(new DOMException("Segmentation cancelled", "AbortError"));
    }
    this.#pending.clear();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.cancel();
    const request: ImageWorkerRequest = { type: "dispose" };
    this.#worker?.postMessage(request);
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#fallbackImage = undefined;
    this.#disposed = true;
  }

  #createWorker(): Worker {
    const worker = this.#workerFactory();
    worker.addEventListener("message", this.#handleMessage);
    worker.addEventListener("error", this.#handleWorkerError);
    const request: ImageWorkerRequest = {
      requestId: this.#nextRequestId++,
      type: "initialize",
    };
    worker.postMessage(request);
    return worker;
  }

  readonly #handleMessage = (
    event: MessageEvent<ImageWorkerResponse>,
  ): void => {
    const response = event.data;
    if (response.type === "progress") {
      this.#onProgress?.(response.stage, response.progress);
      return;
    }
    const pending = this.#pending.get(response.requestId);
    if (!pending) return;
    this.#pending.delete(response.requestId);
    if (response.type === "error") {
      if (response.recoverable) {
        void this.#fallbackSegment(pending.prompts, pending.revision).then(
          pending.resolve,
          pending.reject,
        );
      } else {
        pending.reject(new Error(response.code));
      }
      return;
    }
    if (
      response.revision !== pending.revision ||
      response.revision !== this.#latestRevision
    ) {
      pending.reject(new DOMException("Stale segmentation", "AbortError"));
      return;
    }
    pending.resolve({
      mask: response.mask,
      provider: response.provider,
      revision: response.revision,
    });
  };

  readonly #handleWorkerError = (): void => {
    this.#worker?.terminate();
    this.#worker = undefined;
    const pending = [...this.#pending.values()];
    this.#pending.clear();
    pending.forEach((item) => {
      void this.#fallbackSegment(item.prompts, item.revision).then(
        item.resolve,
        item.reject,
      );
    });
  };

  async #fallbackSegment(
    prompts: ImagePrompt[],
    revision: number,
  ): Promise<ImageSegmentationResult> {
    const image = this.#fallbackImage;
    if (!image) throw new Error("image-not-set");
    await Promise.resolve();
    if (this.#disposed || revision !== this.#latestRevision) {
      throw new DOMException("Stale segmentation", "AbortError");
    }
    const result = createFastPromptMask(image, prompts);
    return { ...result, revision };
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error("Segmentation client was disposed.");
  }
}
