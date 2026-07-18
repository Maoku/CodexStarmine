import type {
  GuidedImagePlacementResult,
  GuidedImagePlacementSettings,
  GuidedMaskProvider,
  ImagePrompt,
  NormalizedImagePoint,
  SegmentationDiagnostics,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import {
  IMAGE_PLACEMENT_MAXIMUM_POINTS,
  IMAGE_PLACEMENT_MINIMUM_POINTS,
  IMAGE_PLACEMENT_SAFETY_RADIUS,
  type ImageDataLike,
} from "./ImagePlacementRecipe";
import type { SectionPoint2D } from "./SliceGeometry";
import { cleanBinarySubjectMask } from "./SubjectMaskPostprocessor";

export const DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS: GuidedImagePlacementSettings =
  {
    targetCount: IMAGE_PLACEMENT_MAXIMUM_POINTS,
  };

interface GridPoint {
  x: number;
  y: number;
}

interface MaskSegment {
  end: GridPoint;
  start: GridPoint;
}

export interface MaskContour {
  hole: boolean;
  length: number;
  points: GridPoint[];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function promptIndex(
  point: NormalizedImagePoint,
  width: number,
  height: number,
): number {
  const x = clamp(Math.floor(point.x * width), 0, width - 1);
  const y = clamp(Math.floor(point.y * height), 0, height - 1);
  return y * width + x;
}

export function cleanSubjectMask(
  mask: SubjectMask,
  prompts: ImagePrompt[],
): SubjectMask {
  if (
    mask.width <= 0 ||
    mask.height <= 0 ||
    mask.data.length < mask.width * mask.height
  ) {
    return { data: new Uint8Array(), height: 0, width: 0 };
  }
  return cleanBinarySubjectMask(
    {
      data: mask.data.slice(0, mask.width * mask.height),
      height: mask.height,
      width: mask.width,
    },
    prompts,
  ).mask;
}

function key(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function contourLength(points: GridPoint[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
}

function signedArea(points: GridPoint[]): number {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function simplifyContour(points: GridPoint[]): GridPoint[] {
  if (points.length <= 3) return points;
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const cross =
      (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x);
    return cross !== 0;
  });
}

export function traceMaskContours(mask: SubjectMask): MaskContour[] {
  const foreground = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < mask.width &&
    y < mask.height &&
    mask.data[y * mask.width + x] > 0;
  const segments: MaskSegment[] = [];
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!foreground(x, y)) continue;
      if (!foreground(x, y - 1))
        segments.push({ start: { x, y }, end: { x: x + 1, y } });
      if (!foreground(x + 1, y))
        segments.push({
          start: { x: x + 1, y },
          end: { x: x + 1, y: y + 1 },
        });
      if (!foreground(x, y + 1))
        segments.push({
          start: { x: x + 1, y: y + 1 },
          end: { x, y: y + 1 },
        });
      if (!foreground(x - 1, y))
        segments.push({ start: { x, y: y + 1 }, end: { x, y } });
    }
  }

  const byStart = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    const indices = byStart.get(key(segment.start)) ?? [];
    indices.push(index);
    byStart.set(key(segment.start), indices);
  });
  const unused = new Set(segments.map((_, index) => index));
  const contours: MaskContour[] = [];
  while (unused.size > 0) {
    const startIndex = [...unused].sort((left, right) => {
      const a = segments[left].start;
      const b = segments[right].start;
      return a.y - b.y || a.x - b.x || left - right;
    })[0];
    const first = segments[startIndex];
    const points = [{ ...first.start }];
    let currentIndex: number | undefined = startIndex;
    let currentEnd = first.end;
    while (currentIndex !== undefined && unused.has(currentIndex)) {
      unused.delete(currentIndex);
      if (key(currentEnd) === key(first.start)) break;
      points.push({ ...currentEnd });
      const next = (byStart.get(key(currentEnd)) ?? [])
        .filter((index) => unused.has(index))
        .sort((left, right) => left - right)[0];
      currentIndex = next;
      if (next !== undefined) currentEnd = segments[next].end;
    }
    const simplified = simplifyContour(points);
    const length = contourLength(simplified);
    if (simplified.length >= 3 && length > 0) {
      contours.push({
        hole: signedArea(simplified) < 0,
        length,
        points: simplified,
      });
    }
  }
  return contours.sort(
    (left, right) =>
      Number(left.hole) - Number(right.hole) ||
      right.length - left.length ||
      left.points[0].y - right.points[0].y ||
      left.points[0].x - right.points[0].x,
  );
}

function sampleContour(contour: MaskContour, count: number): GridPoint[] {
  if (count <= 0) return [];
  const lengths = contour.points.map((point, index) => {
    const next = contour.points[(index + 1) % contour.points.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  const result: GridPoint[] = [];
  for (let sample = 0; sample < count; sample += 1) {
    let target = ((sample + 0.5) / count) * contour.length;
    let edge = 0;
    while (edge < lengths.length - 1 && target > lengths[edge]) {
      target -= lengths[edge];
      edge += 1;
    }
    const start = contour.points[edge];
    const end = contour.points[(edge + 1) % contour.points.length];
    const ratio = lengths[edge] > 0 ? target / lengths[edge] : 0;
    result.push({
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    });
  }
  return result;
}

function allocateByWeight(weights: number[], total: number): number[] {
  if (weights.length === 0) return [];
  const counts = Array.from({ length: weights.length }, () => 0);
  let remaining = total;
  if (total >= weights.length) {
    counts.fill(1);
    remaining -= weights.length;
  }
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const fractions = weights.map((weight, index) => {
    const exact = (remaining * weight) / weightTotal;
    const base = Math.floor(exact);
    counts[index] += base;
    return { fraction: exact - base, index };
  });
  let allocated = counts.reduce((sum, count) => sum + count, 0);
  fractions
    .sort(
      (left, right) =>
        right.fraction - left.fraction || left.index - right.index,
    )
    .forEach(({ index }) => {
      if (allocated >= total) return;
      counts[index] += 1;
      allocated += 1;
    });
  return counts;
}

interface ImageTransform {
  toSection(point: GridPoint): SectionPoint2D;
}

function imageTransform(mask: SubjectMask): ImageTransform | undefined {
  let maximumX = -1;
  let maximumY = -1;
  let minimumX = mask.width;
  let minimumY = mask.height;
  for (let index = 0; index < mask.data.length; index += 1) {
    if (!mask.data[index]) continue;
    const x = index % mask.width;
    const y = Math.floor(index / mask.width);
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x + 1);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y + 1);
  }
  if (maximumX < minimumX || maximumY < minimumY) return undefined;
  const centerX = (minimumX + maximumX) / 2;
  const centerY = (minimumY + maximumY) / 2;
  const maximumRadius = Math.max(
    Math.hypot(minimumX - centerX, minimumY - centerY),
    Math.hypot(maximumX - centerX, minimumY - centerY),
    Math.hypot(minimumX - centerX, maximumY - centerY),
    Math.hypot(maximumX - centerX, maximumY - centerY),
    1,
  );
  const scale = IMAGE_PLACEMENT_SAFETY_RADIUS / maximumRadius;
  return {
    toSection: (point) => ({
      x: (point.x - centerX) * scale,
      y: (centerY - point.y) * scale,
    }),
  };
}

function packColor(red: number, green: number, blue: number): number {
  return (red << 16) | (green << 8) | blue;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)];
}

function representativeColor(image: ImageDataLike, indices: number[]): number {
  if (indices.length === 0) return 0xffffff;
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const stride = Math.max(1, Math.ceil(indices.length / 4096));
  for (let offset = 0; offset < indices.length; offset += stride) {
    const index = indices[offset] * 4;
    red.push(image.data[index] ?? 0);
    green.push(image.data[index + 1] ?? 0);
    blue.push(image.data[index + 2] ?? 0);
  }
  return packColor(median(red), median(green), median(blue));
}

interface FeatureSample {
  color: number;
  point: GridPoint;
}

/*
 * A feature prompt marks the exact spot the user wants preserved, so it maps
 * to a single star at that spot. Only the color comes from the neighborhood,
 * as the median of the masked pixels around the prompt.
 */
function sampleFeature(
  image: ImageDataLike,
  mask: SubjectMask,
  prompt: ImagePrompt,
): FeatureSample {
  const centerX = clamp(prompt.point.x * mask.width, 0.5, mask.width - 0.5);
  const centerY = clamp(prompt.point.y * mask.height, 0.5, mask.height - 0.5);
  const radius = Math.max(
    2,
    Math.round(Math.min(mask.width, mask.height) * 0.06),
  );
  const localIndices: number[] = [];
  for (let y = Math.floor(centerY - radius); y <= centerY + radius; y += 1) {
    for (let x = Math.floor(centerX - radius); x <= centerX + radius; x += 1) {
      if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) continue;
      if (Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY) > radius) continue;
      const index = y * mask.width + x;
      if (!mask.data[index]) continue;
      localIndices.push(index);
    }
  }
  return {
    color: representativeColor(image, localIndices),
    point: { x: centerX, y: centerY },
  };
}

export function createGuidedImagePlacement(
  image: ImageDataLike,
  mask: SubjectMask,
  prompts: ImagePrompt[],
  settings: Partial<GuidedImagePlacementSettings> = {},
  provider: GuidedMaskProvider = "fast",
  maskRevision = 0,
  segmentation?: SegmentationDiagnostics,
): GuidedImagePlacementResult {
  const targetCount = Math.round(
    clamp(
      settings.targetCount ??
        DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.targetCount,
      IMAGE_PLACEMENT_MINIMUM_POINTS,
      IMAGE_PLACEMENT_MAXIMUM_POINTS,
    ),
  );
  const cleaned = cleanSubjectMask(mask, prompts);
  const contours = traceMaskContours(cleaned);
  const transform = imageTransform(cleaned);
  const warnings: string[] = [];
  const empty = (): GuidedImagePlacementResult => ({
    colors: [],
    diagnostics: {
      featurePointCounts: {},
      maskProvider: provider,
      maskRevision,
      outlinePointCount: 0,
      segmentation,
      totalPointCount: 0,
    },
    mask: cleaned,
    points: [],
    warnings,
  });
  if (!transform || contours.length === 0) return empty();

  const validFeatures = prompts.filter((prompt) => {
    if (prompt.kind !== "feature") return false;
    const inside =
      cleaned.data[promptIndex(prompt.point, cleaned.width, cleaned.height)];
    if (!inside) warnings.push(`特徴点「${prompt.id}」は被写体の外側です。`);
    return Boolean(inside);
  });
  const featurePoints: SectionPoint2D[] = [];
  const featureColors: number[] = [];
  const featurePointCounts: Record<string, number> = {};
  validFeatures.forEach((prompt) => {
    const sampled = sampleFeature(image, cleaned, prompt);
    featurePointCounts[prompt.id] = 1;
    featurePoints.push(transform.toSection(sampled.point));
    featureColors.push(sampled.color);
  });
  prompts
    .filter((prompt) => prompt.kind === "feature")
    .forEach((prompt) => (featurePointCounts[prompt.id] ??= 0));

  const outlineBudget = targetCount - featurePoints.length;
  const perContour = allocateByWeight(
    contours.map((contour) => contour.length),
    outlineBudget,
  );
  const outlineGridPoints = contours.flatMap((contour, index) =>
    sampleContour(contour, perContour[index]),
  );
  const subjectIndices: number[] = [];
  cleaned.data.forEach((value, index) => {
    if (value) subjectIndices.push(index);
  });
  const outlineColor = representativeColor(image, subjectIndices);
  const outlinePoints = outlineGridPoints.map(transform.toSection);
  const points = [...outlinePoints, ...featurePoints].filter(
    (point) =>
      Math.hypot(point.x, point.y) <= IMAGE_PLACEMENT_SAFETY_RADIUS + 1e-9,
  );
  const colors = [
    ...outlinePoints.map(() => outlineColor),
    ...featureColors,
  ].slice(0, points.length);
  return {
    colors,
    diagnostics: {
      featurePointCounts,
      maskProvider: provider,
      maskRevision,
      outlinePointCount: outlinePoints.length,
      segmentation,
      totalPointCount: points.length,
    },
    mask: cleaned,
    points,
    warnings,
  };
}
