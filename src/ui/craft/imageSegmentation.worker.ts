import type {
  ImageWorkerRequest,
  ImageWorkerResponse,
} from "./GuidedImagePlacementTypes";
import type { ImageDataLike } from "./ImagePlacementRecipe";
import { createFastPromptMask } from "./PromptMaskProvider";

interface WorkerScope {
  close(): void;
  onmessage: ((event: MessageEvent<ImageWorkerRequest>) => void) | null;
  postMessage(message: ImageWorkerResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
let image: ImageDataLike | undefined;
const cancelled = new Set<number>();

function progress(requestId: number, stage: string, value?: number): void {
  scope.postMessage({
    progress: value,
    requestId,
    stage,
    type: "progress",
  });
}

scope.onmessage = (event): void => {
  const request = event.data;
  if (request.type === "initialize") {
    progress(request.requestId, "fallback-ready", 1);
    return;
  }
  if (request.type === "cancel") {
    cancelled.add(request.requestId);
    return;
  }
  if (request.type === "dispose") {
    image = undefined;
    scope.close();
    return;
  }
  if (request.type === "set-image") {
    try {
      progress(request.requestId, "decoding", 0);
      const canvas = new OffscreenCanvas(
        request.image.width,
        request.image.height,
      );
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("offscreen-canvas-unavailable");
      context.drawImage(request.image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      image = {
        data: pixels.data,
        height: pixels.height,
        width: pixels.width,
      };
      request.image.close();
      progress(request.requestId, "image-ready", 1);
    } catch {
      request.image.close();
      scope.postMessage({
        code: "image-decode-failed",
        recoverable: true,
        requestId: request.requestId,
        type: "error",
      });
    }
    return;
  }
  if (!image) {
    scope.postMessage({
      code: "image-not-set",
      recoverable: true,
      requestId: request.requestId,
      type: "error",
    });
    return;
  }
  if (cancelled.delete(request.requestId)) return;
  progress(request.requestId, "segmenting", 0);
  try {
    const result = createFastPromptMask(image, request.prompts);
    if (cancelled.delete(request.requestId)) return;
    const response: ImageWorkerResponse = {
      mask: result.mask,
      provider: result.provider,
      requestId: request.requestId,
      revision: request.revision,
      type: "mask",
    };
    scope.postMessage(response, [result.mask.data.buffer]);
  } catch {
    scope.postMessage({
      code: "segmentation-failed",
      recoverable: true,
      requestId: request.requestId,
      type: "error",
    });
  }
};
