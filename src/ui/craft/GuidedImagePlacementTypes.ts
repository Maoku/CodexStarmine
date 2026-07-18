import type { ImagePlacementResult } from "./ImagePlacementRecipe";

export type ImagePromptKind = "subject" | "background" | "feature";
export type ImageInputMode = "box" | ImagePromptKind;

export interface NormalizedImagePoint {
  x: number;
  y: number;
}

export interface NormalizedImageRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ImagePrompt {
  id: string;
  kind: ImagePromptKind;
  point: NormalizedImagePoint;
}

export interface GuidedImagePlacementSettings {
  fillInterior: boolean;
  targetCount: number;
}

export interface SubjectMask {
  data: Uint8Array;
  height: number;
  width: number;
}

export interface ProbabilityMask {
  data: Float32Array;
  height: number;
  width: number;
}

export type SegmentationProvider = "alpha" | "slimsam" | "grabcut" | "fast";
export type GuidedMaskProvider = SegmentationProvider;
export type SegmentationExecutionBackend = "webgpu" | "wasm" | "cpu" | "none";

export interface ModelMaskCandidate {
  index: number;
  predictedIoU?: number;
  probabilityMask: ProbabilityMask;
}

export interface CandidateScore {
  boundaryAlignment: number;
  boxAlignment: number;
  composite: number;
  continuity: number;
  index: number;
  modelQuality: number;
  promptViolationCount: number;
  stability: number;
}

export interface SegmentationDiagnostics {
  backend: SegmentationExecutionBackend;
  candidateScores: CandidateScore[];
  constraintRepairApplied: boolean;
  decodeDurationMs?: number;
  encodeDurationMs?: number;
  fallbackReason?: string;
  inputEdge: number;
  localRefinementCount: number;
  peakWorkingBytesEstimate?: number;
  provider: SegmentationProvider;
  selectedCandidate?: number;
  selectedThreshold?: number;
}

export interface GuidedPlacementDiagnostics {
  featurePointCounts: Record<string, number>;
  interiorPointCount: number;
  maskProvider: SegmentationProvider;
  maskRevision: number;
  outlinePointCount: number;
  segmentation?: SegmentationDiagnostics;
  totalPointCount: number;
}

export interface GuidedImagePlacementResult extends ImagePlacementResult {
  diagnostics: GuidedPlacementDiagnostics;
  mask: SubjectMask;
  warnings: string[];
}

export type SegmentationMode = "auto" | "fast";

export interface SegmentationImageSource {
  pixels: Uint8ClampedArray;
  imageId: string;
  sourceHeight: number;
  sourceWidth: number;
}

export interface ImageEmbeddingInfo {
  height: number;
  imageId: string;
  inputEdge: number;
  width: number;
}

export interface ModelPromptInput {
  previousMask?: ProbabilityMask;
  prompts: ImagePrompt[];
  subjectBox?: NormalizedImageRect;
}

export interface PromptMaskProvider {
  readonly backend: SegmentationExecutionBackend;
  readonly provider: SegmentationProvider;
  decodeCandidates(input: ModelPromptInput): Promise<ModelMaskCandidate[]>;
  dispose(): void;
  disposeImage(): void;
  initialize(): Promise<void>;
  setImage(image: SegmentationImageSource): Promise<ImageEmbeddingInfo>;
}

export type ImageWorkerRequest =
  | {
      type: "initialize";
      requestId: number;
      mode: SegmentationMode;
      modelBaseUrl: string;
      wasmBaseUrl: string;
    }
  | {
      type: "set-image";
      requestId: number;
      imageId: string;
      image: ImageBitmap;
    }
  | {
      type: "segment";
      requestId: number;
      imageId: string;
      previousMaskId?: string;
      revision: number;
      prompts: ImagePrompt[];
      subjectBox?: NormalizedImageRect;
    }
  | { type: "cancel"; requestId: number; imageId?: string }
  | { type: "dispose-image"; imageId: string }
  | { type: "dispose" };

export type ImageWorkerResponse =
  | {
      type: "initialized";
      requestId: number;
      provider: SegmentationProvider;
      backend: SegmentationExecutionBackend;
      modelVersion?: string;
      fallbackReason?: string;
    }
  | {
      type: "embedding-ready";
      requestId: number;
      imageId: string;
      provider: SegmentationProvider;
      backend: SegmentationExecutionBackend;
      inputEdge: number;
    }
  | {
      type: "progress";
      requestId: number;
      imageId?: string;
      stage: string;
      progress?: number;
    }
  | {
      type: "segmentation";
      requestId: number;
      imageId: string;
      revision: number;
      maskId: string;
      probabilityMask: ProbabilityMask;
      mask: SubjectMask;
      diagnostics: SegmentationDiagnostics;
      constraintsSatisfied: boolean;
    }
  | {
      type: "error";
      requestId: number;
      imageId?: string;
      code: string;
      recoverable: boolean;
    };
