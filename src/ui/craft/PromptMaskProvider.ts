import type {
  ImagePrompt,
  NormalizedImageRect,
  ProbabilityMask,
  SegmentationDiagnostics,
  SegmentationProvider,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import type { ImageDataLike } from "./ImagePlacementRecipe";
import { selectMaskCandidate } from "./MaskCandidateSelector";
import { postprocessProbabilityMask } from "./SubjectMaskPostprocessor";

export interface PromptMaskResult {
  constraintsSatisfied: boolean;
  diagnostics: SegmentationDiagnostics;
  mask: SubjectMask;
  probabilityMask: ProbabilityMask;
  provider: SegmentationProvider;
}

export interface SynchronousPromptMaskProvider {
  readonly kind: SegmentationProvider;
  segment(
    image: ImageDataLike,
    prompts: ImagePrompt[],
    subjectBox?: NormalizedImageRect,
  ): PromptMaskResult;
}

interface RGB {
  blue: number;
  green: number;
  red: number;
}

interface Lab {
  a: number;
  b: number;
  lightness: number;
}

function pixelIndex(
  point: { x: number; y: number },
  width: number,
  height: number,
): number {
  const x = Math.min(width - 1, Math.max(0, Math.floor(point.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(point.y * height)));
  return y * width + x;
}

function colorAt(image: ImageDataLike, index: number): RGB {
  const offset = index * 4;
  return {
    blue: image.data[offset + 2] ?? 0,
    green: image.data[offset + 1] ?? 0,
    red: image.data[offset] ?? 0,
  };
}

function median(values: number[]): number {
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)] ?? 0;
}

function patchMedian(
  image: ImageDataLike,
  point: { x: number; y: number },
): RGB {
  const center = pixelIndex(point, image.width, image.height);
  const centerX = center % image.width;
  const centerY = Math.floor(center / image.width);
  const radius = Math.max(
    2,
    Math.min(5, Math.round(Math.min(image.width, image.height) / 80)),
  );
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const color = colorAt(image, y * image.width + x);
      red.push(color.red);
      green.push(color.green);
      blue.push(color.blue);
    }
  }
  return { blue: median(blue), green: median(green), red: median(red) };
}

function linearChannel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function lab(color: RGB): Lab {
  const red = linearChannel(color.red);
  const green = linearChannel(color.green);
  const blue = linearChannel(color.blue);
  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047;
  const y = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883;
  const pivot = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return {
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
    lightness: 116 * fy - 16,
  };
}

function labDistance(left: Lab, right: Lab): number {
  return Math.hypot(
    left.lightness - right.lightness,
    left.a - right.a,
    left.b - right.b,
  );
}

function borderIndices(width: number, height: number): number[] {
  const indices: number[] = [];
  const stride = Math.max(1, Math.floor(Math.max(width, height) / 32));
  for (let x = 0; x < width; x += stride) {
    indices.push(x, (height - 1) * width + x);
  }
  for (let y = stride; y < height - 1; y += stride) {
    indices.push(y * width, y * width + width - 1);
  }
  return indices;
}

function nearestDistance(color: Lab, references: Lab[]): number {
  return references.reduce(
    (best, reference) => Math.min(best, labDistance(color, reference)),
    Number.POSITIVE_INFINITY,
  );
}

function clusterReferences(references: Lab[], maximum = 5): Lab[] {
  if (references.length <= maximum) return references;
  const sorted = [...references].sort(
    (left, right) => left.lightness - right.lightness,
  );
  let centers = Array.from({ length: maximum }, (_, index) => ({
    ...sorted[Math.floor((index / (maximum - 1)) * (sorted.length - 1))],
  }));
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const groups = centers.map(() => [] as Lab[]);
    for (const reference of references) {
      let selected = 0;
      for (let index = 1; index < centers.length; index += 1) {
        if (
          labDistance(reference, centers[index]) <
          labDistance(reference, centers[selected])
        ) {
          selected = index;
        }
      }
      groups[selected].push(reference);
    }
    centers = centers.map((center, index) => {
      const group = groups[index];
      if (group.length === 0) return center;
      return {
        a: group.reduce((sum, value) => sum + value.a, 0) / group.length,
        b: group.reduce((sum, value) => sum + value.b, 0) / group.length,
        lightness:
          group.reduce((sum, value) => sum + value.lightness, 0) / group.length,
      };
    });
  }
  return centers;
}

export function hasUsefulImageAlpha(image: ImageDataLike): boolean {
  let transparent = 0;
  let opaque = 0;
  for (let index = 0; index < image.width * image.height; index += 1) {
    const alpha = image.data[index * 4 + 3] ?? 0;
    if (alpha <= 16) transparent += 1;
    if (alpha >= 224) opaque += 1;
  }
  const minimum = Math.max(1, Math.floor(image.width * image.height * 0.005));
  return transparent >= minimum && opaque >= minimum;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function insideBox(
  index: number,
  width: number,
  height: number,
  box: NormalizedImageRect | undefined,
): boolean {
  if (!box) return true;
  const x = ((index % width) + 0.5) / width;
  const y = (Math.floor(index / width) + 0.5) / height;
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

function createProbabilityMask(
  image: ImageDataLike,
  prompts: ImagePrompt[],
  subjectBox: NormalizedImageRect | undefined,
  usefulAlpha: boolean,
): ProbabilityMask {
  const length = image.width * image.height;
  const data = new Float32Array(length);
  if (usefulAlpha) {
    for (let index = 0; index < length; index += 1) {
      data[index] = (image.data[index * 4 + 3] ?? 0) / 255;
    }
    return { data, height: image.height, width: image.width };
  }

  const subjectReferences = prompts
    .filter((prompt) => prompt.kind === "subject")
    .map((prompt) => lab(patchMedian(image, prompt.point)));
  const explicitBackground = prompts
    .filter((prompt) => prompt.kind === "background")
    .map((prompt) => lab(patchMedian(image, prompt.point)));
  const borderReferences = clusterReferences(
    borderIndices(image.width, image.height).map((index) =>
      lab(colorAt(image, index)),
    ),
  );
  const backgroundReferences = [...explicitBackground, ...borderReferences];
  for (let index = 0; index < length; index += 1) {
    const alpha = (image.data[index * 4 + 3] ?? 0) / 255;
    if (alpha <= 0.02) continue;
    const color = lab(colorAt(image, index));
    const backgroundDistance = nearestDistance(color, backgroundReferences);
    let probability: number;
    if (subjectReferences.length > 0) {
      const subjectDistance = nearestDistance(color, subjectReferences);
      probability = sigmoid((backgroundDistance - subjectDistance - 2) / 7);
      if (subjectDistance > 65) probability *= 0.6;
    } else {
      probability = sigmoid((backgroundDistance - 7) / 4);
    }
    if (!insideBox(index, image.width, image.height, subjectBox)) {
      probability *= 0.55;
    } else if (subjectBox) {
      probability = Math.min(1, probability + 0.05);
    }
    data[index] = probability * alpha;
  }
  return { data, height: image.height, width: image.width };
}

export function createFastPromptMask(
  image: ImageDataLike,
  prompts: ImagePrompt[],
  subjectBox?: NormalizedImageRect,
  previousMask?: SubjectMask,
): PromptMaskResult {
  const alpha = hasUsefulImageAlpha(image);
  const provider: SegmentationProvider = alpha ? "alpha" : "fast";
  const probabilityMask = createProbabilityMask(
    image,
    prompts,
    subjectBox,
    alpha,
  );
  const selection = selectMaskCandidate([{ index: 0, probabilityMask }], {
    image,
    previousMask,
    prompts,
    subjectBox,
  });
  const processed = postprocessProbabilityMask(probabilityMask, prompts, {
    subjectBox,
    threshold: selection.threshold,
  });
  return {
    constraintsSatisfied: processed.constraintsSatisfied,
    diagnostics: {
      backend: provider === "alpha" ? "none" : "cpu",
      candidateScores: selection.scores,
      constraintRepairApplied: processed.constraintRepairApplied,
      inputEdge: Math.max(image.width, image.height),
      localRefinementCount: 0,
      peakWorkingBytesEstimate:
        image.data.length * Uint8ClampedArray.BYTES_PER_ELEMENT +
        probabilityMask.data.byteLength +
        processed.mask.data.byteLength,
      provider,
      selectedCandidate: selection.candidate.index,
      selectedThreshold: selection.threshold,
    },
    mask: processed.mask,
    probabilityMask,
    provider,
  };
}

export const FAST_PROMPT_MASK_PROVIDER: SynchronousPromptMaskProvider = {
  kind: "fast",
  segment: createFastPromptMask,
};
