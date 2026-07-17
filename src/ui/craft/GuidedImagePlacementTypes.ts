import type { ImagePlacementResult } from "./ImagePlacementRecipe";

export type ImagePromptKind = "subject" | "background" | "feature";

export interface NormalizedImagePoint {
  x: number;
  y: number;
}

export interface ImagePrompt {
  id: string;
  kind: ImagePromptKind;
  point: NormalizedImagePoint;
}

export interface GuidedImagePlacementSettings {
  featureBudgetRatio: number;
  targetCount: number;
}

export interface SubjectMask {
  data: Uint8Array;
  height: number;
  width: number;
}

export type GuidedMaskProvider = "alpha" | "fast" | "slimsam" | "fallback";

export interface GuidedPlacementDiagnostics {
  featurePointCounts: Record<string, number>;
  maskProvider: GuidedMaskProvider;
  maskRevision: number;
  outlinePointCount: number;
  totalPointCount: number;
}

export interface GuidedImagePlacementResult extends ImagePlacementResult {
  diagnostics: GuidedPlacementDiagnostics;
  mask: SubjectMask;
  warnings: string[];
}

export type ImageWorkerRequest =
  | { type: "initialize"; requestId: number }
  | { type: "set-image"; requestId: number; image: ImageBitmap }
  | {
      type: "segment";
      requestId: number;
      revision: number;
      prompts: ImagePrompt[];
    }
  | { type: "cancel"; requestId: number }
  | { type: "dispose" };

export type ImageWorkerResponse =
  | {
      type: "progress";
      requestId: number;
      stage: string;
      progress?: number;
    }
  | {
      type: "mask";
      requestId: number;
      revision: number;
      mask: SubjectMask;
      provider: GuidedMaskProvider;
    }
  | {
      type: "error";
      requestId: number;
      code: string;
      recoverable: boolean;
    };
