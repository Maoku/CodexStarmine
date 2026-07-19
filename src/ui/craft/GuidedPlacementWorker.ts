import {
  analyzeGuidedSubject,
  createGuidedImagePlacementFromAnalysis,
  type GuidedSubjectAnalysis,
} from "./GuidedImagePlacementRecipe";
import type {
  PlacementWorkerRequest,
  PlacementWorkerResponse,
  SubjectMask,
} from "./GuidedImagePlacementTypes";

interface WorkerScope {
  onmessage: ((event: MessageEvent<PlacementWorkerRequest>) => void) | null;
  postMessage(message: PlacementWorkerResponse): void;
}

interface AnalysisCache {
  analysis: GuidedSubjectAnalysis;
  maskSignature: number;
  promptSignature: string;
  revision: number;
}

const scope = self as unknown as WorkerScope;
let cache: AnalysisCache | undefined;
let latestRequestId = 0;

function subjectMaskSignature(mask: SubjectMask): number {
  let signature = 2166136261;
  for (let index = 0; index < mask.data.length; index += 1) {
    signature ^= mask.data[index];
    signature = Math.imul(signature, 16777619);
  }
  signature ^= mask.width;
  signature = Math.imul(signature, 16777619);
  signature ^= mask.height;
  return signature >>> 0;
}

function postProgress(
  requestId: number,
  stage: Extract<PlacementWorkerResponse, { type: "progress" }>["stage"],
  progress?: number,
): void {
  scope.postMessage({ progress, requestId, stage, type: "progress" });
}

function buildPlacement(request: PlacementWorkerRequest): void {
  latestRequestId = Math.max(latestRequestId, request.requestId);
  const maskSignature = subjectMaskSignature(request.mask);
  const promptSignature = request.prompts
    .filter((prompt) => prompt.kind === "feature")
    .map(
      (prompt) =>
        `${prompt.id}:${prompt.point.x.toFixed(6)}:${prompt.point.y.toFixed(6)}`,
    )
    .join("|");
  let analysis =
    cache?.revision === request.revision &&
    cache.maskSignature === maskSignature &&
    cache.promptSignature === promptSignature
      ? cache.analysis
      : undefined;
  if (!analysis) {
    analysis = analyzeGuidedSubject(
      request.image,
      request.mask,
      request.prompts,
      (stage) => postProgress(request.requestId, stage),
    );
    cache = {
      analysis,
      maskSignature,
      promptSignature,
      revision: request.revision,
    };
  }
  if (request.requestId < latestRequestId) return;
  postProgress(request.requestId, "placing-stars");
  const placement = createGuidedImagePlacementFromAnalysis(
    request.image,
    analysis,
    request.prompts,
    request.settings,
    request.maskProvider,
    request.revision,
    request.segmentation,
  );
  if (request.requestId < latestRequestId) return;
  scope.postMessage({
    placement,
    requestId: request.requestId,
    revision: request.revision,
    type: "placement",
  });
}

scope.onmessage = (event): void => {
  const request = event.data;
  try {
    buildPlacement(request);
  } catch (error) {
    scope.postMessage({
      error: error instanceof Error ? error.message : "placement-worker-failed",
      requestId: request.requestId,
      type: "error",
    });
  }
};
