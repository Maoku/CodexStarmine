import type { ImagePrompt, SubjectMask } from "./GuidedImagePlacementTypes";
import { countPromptViolations, maskIoU } from "./MaskCandidateSelector";

interface PixelPoint {
  x: number;
  y: number;
}

export interface SegmentationMetrics {
  boundaryF1: number;
  maskIoU: number;
  normalizedBoundaryDistance: number;
  promptViolationCount: number;
}

function boundaryPoints(mask: SubjectMask): PixelPoint[] {
  const points: PixelPoint[] = [];
  const foreground = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < mask.width &&
    y < mask.height &&
    mask.data[y * mask.width + x] > 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!foreground(x, y)) continue;
      if (
        !foreground(x - 1, y) ||
        !foreground(x + 1, y) ||
        !foreground(x, y - 1) ||
        !foreground(x, y + 1)
      ) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

function matchingRatio(
  source: PixelPoint[],
  target: PixelPoint[],
  tolerance: number,
): number {
  if (source.length === 0) return target.length === 0 ? 1 : 0;
  let matches = 0;
  for (const point of source) {
    if (
      target.some(
        (candidate) =>
          Math.hypot(candidate.x - point.x, candidate.y - point.y) <= tolerance,
      )
    ) {
      matches += 1;
    }
  }
  return matches / source.length;
}

export function boundaryF1(
  prediction: SubjectMask,
  groundTruth: SubjectMask,
  tolerance = 1,
): number {
  if (
    prediction.width !== groundTruth.width ||
    prediction.height !== groundTruth.height
  ) {
    return 0;
  }
  const predictedBoundary = boundaryPoints(prediction);
  const truthBoundary = boundaryPoints(groundTruth);
  if (predictedBoundary.length === 0 && truthBoundary.length === 0) return 1;
  const precision = matchingRatio(predictedBoundary, truthBoundary, tolerance);
  const recall = matchingRatio(truthBoundary, predictedBoundary, tolerance);
  return precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
}

function directedBoundaryDistance(
  source: PixelPoint[],
  target: PixelPoint[],
): number {
  if (source.length === 0) return target.length === 0 ? 0 : 1;
  if (target.length === 0) return 1;
  return (
    source.reduce(
      (sum, point) =>
        sum +
        target.reduce(
          (minimum, candidate) =>
            Math.min(
              minimum,
              Math.hypot(candidate.x - point.x, candidate.y - point.y),
            ),
          Number.POSITIVE_INFINITY,
        ),
      0,
    ) / source.length
  );
}

export function normalizedBoundaryDistance(
  prediction: SubjectMask,
  groundTruth: SubjectMask,
): number {
  if (
    prediction.width !== groundTruth.width ||
    prediction.height !== groundTruth.height
  ) {
    return 1;
  }
  const predictedBoundary = boundaryPoints(prediction);
  const truthBoundary = boundaryPoints(groundTruth);
  const diagonal = Math.max(1, Math.hypot(prediction.width, prediction.height));
  return Math.min(
    1,
    (directedBoundaryDistance(predictedBoundary, truthBoundary) +
      directedBoundaryDistance(truthBoundary, predictedBoundary)) /
      2 /
      diagonal,
  );
}

export function evaluateSegmentation(
  prediction: SubjectMask,
  groundTruth: SubjectMask,
  prompts: ImagePrompt[] = [],
  boundaryTolerance = 1,
): SegmentationMetrics {
  return {
    boundaryF1: boundaryF1(prediction, groundTruth, boundaryTolerance),
    maskIoU: maskIoU(prediction, groundTruth),
    normalizedBoundaryDistance: normalizedBoundaryDistance(
      prediction,
      groundTruth,
    ),
    promptViolationCount: countPromptViolations(prediction, prompts),
  };
}
