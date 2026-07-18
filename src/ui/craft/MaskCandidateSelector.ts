import type {
  CandidateScore,
  ImagePrompt,
  ModelMaskCandidate,
  NormalizedImageRect,
  ProbabilityMask,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import type { ImageDataLike } from "./ImagePlacementRecipe";

export interface MaskCandidateWeights {
  boundaryAlignment: number;
  boxAlignment: number;
  continuity: number;
  modelQuality: number;
  stability: number;
}

export const DEFAULT_MASK_CANDIDATE_WEIGHTS: MaskCandidateWeights = {
  boundaryAlignment: 0.15,
  boxAlignment: 0.1,
  continuity: 0.1,
  modelQuality: 0.4,
  stability: 0.25,
};

export interface MaskCandidateSelectionInput {
  image?: ImageDataLike;
  previousMask?: SubjectMask;
  prompts: ImagePrompt[];
  subjectBox?: NormalizedImageRect;
  weights?: Partial<MaskCandidateWeights>;
}

export interface ThresholdScore {
  boundaryAlignment: number;
  promptViolationCount: number;
  stability: number;
  threshold: number;
}

export interface MaskCandidateSelection {
  candidate: ModelMaskCandidate;
  mask: SubjectMask;
  score: CandidateScore;
  scores: CandidateScore[];
  threshold: number;
  thresholdScores: ThresholdScore[];
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function pointIndex(
  point: { x: number; y: number },
  width: number,
  height: number,
): number {
  const x = Math.min(width - 1, Math.max(0, Math.floor(point.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(point.y * height)));
  return y * width + x;
}

export function thresholdProbabilityMask(
  probabilityMask: ProbabilityMask,
  threshold: number,
): SubjectMask {
  const length = probabilityMask.width * probabilityMask.height;
  const data = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    if ((probabilityMask.data[index] ?? 0) >= threshold) data[index] = 255;
  }
  return {
    data,
    height: probabilityMask.height,
    width: probabilityMask.width,
  };
}

export function maskIoU(left: SubjectMask, right: SubjectMask): number {
  if (
    left.width !== right.width ||
    left.height !== right.height ||
    left.data.length < left.width * left.height ||
    right.data.length < right.width * right.height
  ) {
    return 0;
  }
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.width * left.height; index += 1) {
    const leftValue = left.data[index] > 0;
    const rightValue = right.data[index] > 0;
    if (leftValue && rightValue) intersection += 1;
    if (leftValue || rightValue) union += 1;
  }
  return union === 0 ? 1 : intersection / union;
}

export function countPromptViolations(
  mask: SubjectMask,
  prompts: ImagePrompt[],
): number {
  const length = mask.width * mask.height;
  if (mask.width <= 0 || mask.height <= 0 || mask.data.length < length) {
    return prompts.filter((prompt) => prompt.kind !== "feature").length + 1;
  }
  let foreground = 0;
  for (let index = 0; index < length; index += 1) {
    if (mask.data[index]) foreground += 1;
  }
  let violations = foreground === 0 || foreground === length ? 1 : 0;
  for (const prompt of prompts) {
    if (prompt.kind === "feature") continue;
    const inside =
      mask.data[pointIndex(prompt.point, mask.width, mask.height)] > 0;
    if (prompt.kind === "subject" ? !inside : inside) violations += 1;
  }
  return violations;
}

function boxAlignment(
  mask: SubjectMask,
  box: NormalizedImageRect | undefined,
): number {
  if (!box) return 0.5;
  let outside = 0;
  let foreground = 0;
  for (let index = 0; index < mask.width * mask.height; index += 1) {
    if (!mask.data[index]) continue;
    foreground += 1;
    const x = ((index % mask.width) + 0.5) / mask.width;
    const y = (Math.floor(index / mask.width) + 0.5) / mask.height;
    if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
      outside += 1;
    }
  }
  return foreground === 0 ? 0 : 1 - outside / foreground;
}

function grayscaleAt(image: ImageDataLike, x: number, y: number): number {
  const offset = (y * image.width + x) * 4;
  return (
    (image.data[offset] ?? 0) * 0.299 +
    (image.data[offset + 1] ?? 0) * 0.587 +
    (image.data[offset + 2] ?? 0) * 0.114
  );
}

interface BoundaryGradient {
  data: Float32Array;
  height: number;
  maximum: number;
  width: number;
}

function createBoundaryGradient(
  image: ImageDataLike | undefined,
  width: number,
  height: number,
): BoundaryGradient | undefined {
  if (!image || image.width !== width || image.height !== height)
    return undefined;
  const data = new Float32Array(width * height);
  let maximumGradient = 0;
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const topLeft = grayscaleAt(image, x - 1, y - 1);
      const top = grayscaleAt(image, x, y - 1);
      const topRight = grayscaleAt(image, x + 1, y - 1);
      const left = grayscaleAt(image, x - 1, y);
      const right = grayscaleAt(image, x + 1, y);
      const bottomLeft = grayscaleAt(image, x - 1, y + 1);
      const bottom = grayscaleAt(image, x, y + 1);
      const bottomRight = grayscaleAt(image, x + 1, y + 1);
      const gradient = Math.hypot(
        -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight,
        -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight,
      );
      data[y * width + x] = gradient;
      maximumGradient = Math.max(maximumGradient, gradient);
    }
  }
  return {
    data,
    height,
    maximum: maximumGradient,
    width,
  };
}

function boundaryAlignment(
  mask: SubjectMask,
  gradient: BoundaryGradient | undefined,
): number {
  if (
    !gradient ||
    gradient.width !== mask.width ||
    gradient.height !== mask.height
  ) {
    return 0.5;
  }
  let boundaryGradient = 0;
  let boundaryCount = 0;
  for (let y = 1; y < mask.height - 1; y += 1) {
    for (let x = 1; x < mask.width - 1; x += 1) {
      const index = y * mask.width + x;
      const value = mask.data[index] > 0;
      if (
        mask.data[index - 1] > 0 !== value ||
        mask.data[index + 1] > 0 !== value ||
        mask.data[index - mask.width] > 0 !== value ||
        mask.data[index + mask.width] > 0 !== value
      ) {
        boundaryGradient += gradient.data[index];
        boundaryCount += 1;
      }
    }
  }
  if (boundaryCount === 0 || gradient.maximum === 0) return 0;
  return clamp01(boundaryGradient / boundaryCount / gradient.maximum);
}

function candidateScore(
  candidate: ModelMaskCandidate,
  input: MaskCandidateSelectionInput,
  weights: MaskCandidateWeights,
  gradient: BoundaryGradient | undefined,
): CandidateScore {
  const low = thresholdProbabilityMask(candidate.probabilityMask, 0.45);
  const high = thresholdProbabilityMask(candidate.probabilityMask, 0.55);
  const stability = maskIoU(low, high);
  const thresholdMasks = [0.45, 0.5, 0.55].map((threshold) => ({
    boundaryAlignment: 0,
    mask: thresholdProbabilityMask(candidate.probabilityMask, threshold),
    promptViolationCount: 0,
    threshold,
  }));
  thresholdMasks.forEach((item) => {
    item.boundaryAlignment = boundaryAlignment(item.mask, gradient);
    item.promptViolationCount = countPromptViolations(item.mask, input.prompts);
  });
  thresholdMasks.sort((left, right) => {
    const violationDifference =
      left.promptViolationCount - right.promptViolationCount;
    if (violationDifference !== 0) return violationDifference;
    const alignmentDifference =
      right.boundaryAlignment - left.boundaryAlignment;
    if (alignmentDifference !== 0) return alignmentDifference;
    return Math.abs(left.threshold - 0.5) - Math.abs(right.threshold - 0.5);
  });
  const representative = thresholdMasks[0].mask;
  const modelQuality = clamp01(candidate.predictedIoU ?? 0.5);
  const boundary = thresholdMasks[0].boundaryAlignment;
  const box = boxAlignment(representative, input.subjectBox);
  const continuity = input.previousMask
    ? maskIoU(representative, input.previousMask)
    : 0.5;
  return {
    boundaryAlignment: boundary,
    boxAlignment: box,
    composite:
      modelQuality * weights.modelQuality +
      stability * weights.stability +
      boundary * weights.boundaryAlignment +
      box * weights.boxAlignment +
      continuity * weights.continuity,
    continuity,
    index: candidate.index,
    modelQuality,
    promptViolationCount: countPromptViolations(representative, input.prompts),
    stability,
  };
}

function finalThresholds(
  probabilityMask: ProbabilityMask,
  input: MaskCandidateSelectionInput,
  gradient: BoundaryGradient | undefined,
): ThresholdScore[] {
  const scores: ThresholdScore[] = [];
  for (let step = 0; step <= 12; step += 1) {
    const threshold = Number((0.35 + step * 0.025).toFixed(3));
    const mask = thresholdProbabilityMask(probabilityMask, threshold);
    const lower = thresholdProbabilityMask(
      probabilityMask,
      Math.max(0, threshold - 0.025),
    );
    const upper = thresholdProbabilityMask(
      probabilityMask,
      Math.min(1, threshold + 0.025),
    );
    scores.push({
      boundaryAlignment: boundaryAlignment(mask, gradient),
      promptViolationCount: countPromptViolations(mask, input.prompts),
      stability: maskIoU(lower, upper),
      threshold,
    });
  }
  return scores;
}

export function selectMaskCandidate(
  candidates: ModelMaskCandidate[],
  input: MaskCandidateSelectionInput,
): MaskCandidateSelection {
  if (candidates.length === 0) {
    throw new Error("At least one mask candidate is required.");
  }
  const first = candidates[0].probabilityMask;
  if (
    first.width <= 0 ||
    first.height <= 0 ||
    candidates.some(
      (candidate) =>
        candidate.probabilityMask.width !== first.width ||
        candidate.probabilityMask.height !== first.height ||
        candidate.probabilityMask.data.length < first.width * first.height,
    )
  ) {
    throw new Error("Mask candidates must have matching non-empty dimensions.");
  }
  const weights = { ...DEFAULT_MASK_CANDIDATE_WEIGHTS, ...input.weights };
  const gradient = createBoundaryGradient(
    input.image,
    first.width,
    first.height,
  );
  const scores = candidates.map((candidate) =>
    candidateScore(candidate, input, weights, gradient),
  );
  scores.sort((left, right) => {
    if (left.promptViolationCount !== right.promptViolationCount) {
      return left.promptViolationCount - right.promptViolationCount;
    }
    if (left.composite !== right.composite)
      return right.composite - left.composite;
    return left.index - right.index;
  });
  const score = scores[0];
  const candidate = candidates.find((item) => item.index === score.index);
  if (!candidate) throw new Error("Selected mask candidate is unavailable.");
  const thresholdScores = finalThresholds(
    candidate.probabilityMask,
    input,
    gradient,
  );
  thresholdScores.sort((left, right) => {
    if (left.promptViolationCount !== right.promptViolationCount) {
      return left.promptViolationCount - right.promptViolationCount;
    }
    if (left.stability !== right.stability)
      return right.stability - left.stability;
    if (left.boundaryAlignment !== right.boundaryAlignment) {
      return right.boundaryAlignment - left.boundaryAlignment;
    }
    const centerDifference =
      Math.abs(left.threshold - 0.5) - Math.abs(right.threshold - 0.5);
    return centerDifference || left.threshold - right.threshold;
  });
  const threshold = thresholdScores[0].threshold;
  return {
    candidate,
    mask: thresholdProbabilityMask(candidate.probabilityMask, threshold),
    score,
    scores,
    threshold,
    thresholdScores,
  };
}
