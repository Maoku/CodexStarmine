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
  DEFAULT_IMAGE_PLACEMENT_SETTINGS,
  IMAGE_PLACEMENT_MAXIMUM_POINTS,
  IMAGE_PLACEMENT_MINIMUM_POINTS,
  IMAGE_PLACEMENT_SAFETY_RADIUS,
  quantizeImageColors,
  type ImageDataLike,
} from "./ImagePlacementRecipe";
import type { SectionPoint2D } from "./SliceGeometry";
import { cleanBinarySubjectMask } from "./SubjectMaskPostprocessor";

export const DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS: GuidedImagePlacementSettings =
  {
    fillInterior: false,
    targetCount: DEFAULT_IMAGE_PLACEMENT_SETTINGS.targetCount,
  };

export const GUIDED_FILLED_OUTLINE_MAXIMUM_POINTS = 240;
export const GUIDED_INTERIOR_MAXIMUM_COLORS = 4;
export const GUIDED_OUTLINE_MAXIMUM_COLORS = 3;

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

function halton(index: number, base: number): number {
  let fraction = 1;
  let result = 0;
  let value = index;
  while (value > 0) {
    fraction /= base;
    result += fraction * (value % base);
    value = Math.floor(value / base);
  }
  return result;
}

function interiorPixel(mask: SubjectMask, x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= mask.width - 1 || y >= mask.height - 1) {
    return false;
  }
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (!mask.data[(y + offsetY) * mask.width + x + offsetX]) return false;
    }
  }
  return true;
}

/*
 * A low-discrepancy sequence keeps the fill even without making placement
 * random. Pixel centers are used so every generated point remains inside the
 * cleaned subject mask. A scan-order fallback covers unusually thin masks.
 */
function sampleInterior(
  mask: SubjectMask,
  count: number,
  excluded: GridPoint[],
): GridPoint[] {
  if (count <= 0) return [];
  const candidates: number[] = [];
  let maximumX = -1;
  let maximumY = -1;
  let minimumX = mask.width;
  let minimumY = mask.height;
  for (let y = 1; y < mask.height - 1; y += 1) {
    for (let x = 1; x < mask.width - 1; x += 1) {
      if (!interiorPixel(mask, x, y)) continue;
      const tooCloseToFeature = excluded.some(
        (point) => Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) < 1,
      );
      if (tooCloseToFeature) continue;
      candidates.push(y * mask.width + x);
      minimumX = Math.min(minimumX, x);
      maximumX = Math.max(maximumX, x);
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y);
    }
  }
  if (candidates.length <= count) {
    return candidates.map((index) => ({
      x: (index % mask.width) + 0.5,
      y: Math.floor(index / mask.width) + 0.5,
    }));
  }

  const candidateSet = new Set(candidates);
  const selected = new Set<number>();
  const maximumAttempts = Math.max(count * 64, 4096);
  for (
    let sequenceIndex = 1;
    selected.size < count && sequenceIndex <= maximumAttempts;
    sequenceIndex += 1
  ) {
    const x = Math.min(
      maximumX,
      minimumX +
        Math.floor(halton(sequenceIndex, 2) * (maximumX - minimumX + 1)),
    );
    const y = Math.min(
      maximumY,
      minimumY +
        Math.floor(halton(sequenceIndex, 3) * (maximumY - minimumY + 1)),
    );
    const index = y * mask.width + x;
    if (candidateSet.has(index)) selected.add(index);
  }
  if (selected.size < count) {
    const remaining = candidates.filter((index) => !selected.has(index));
    const needed = count - selected.size;
    for (let sample = 0; sample < needed; sample += 1) {
      selected.add(
        remaining[
          Math.min(
            remaining.length - 1,
            Math.floor(((sample + 0.5) / needed) * remaining.length),
          )
        ],
      );
    }
  }
  return [...selected].map((index) => ({
    x: (index % mask.width) + 0.5,
    y: Math.floor(index / mask.width) + 0.5,
  }));
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

function sampleOutlineColor(
  image: ImageDataLike,
  mask: SubjectMask,
  point: GridPoint,
): number {
  const maskIndices: number[] = [];
  const radius = 2;
  for (let y = Math.floor(point.y - radius); y <= point.y + radius; y += 1) {
    for (let x = Math.floor(point.x - radius); x <= point.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) continue;
      if (Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) > radius) continue;
      const maskIndex = y * mask.width + x;
      if (mask.data[maskIndex]) maskIndices.push(maskIndex);
    }
  }
  return representativeColor(image, maskIndices);
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
      interiorPointCount: 0,
      maskProvider: provider,
      maskRevision,
      outlinePointCount: 0,
      segmentation,
      totalPointCount: 0,
    },
    mask: cleaned,
    points: [],
    preserveColorAssignments: true,
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
  const featureGridPoints: GridPoint[] = [];
  const featureColors: number[] = [];
  const featurePointCounts: Record<string, number> = {};
  validFeatures.forEach((prompt) => {
    const sampled = sampleFeature(image, cleaned, prompt);
    featurePointCounts[prompt.id] = 1;
    featureGridPoints.push(sampled.point);
    featurePoints.push(transform.toSection(sampled.point));
    featureColors.push(sampled.color);
  });
  prompts
    .filter((prompt) => prompt.kind === "feature")
    .forEach((prompt) => (featurePointCounts[prompt.id] ??= 0));

  const placementBudget = Math.max(0, targetCount - featurePoints.length);
  const requestedInteriorCount =
    (settings.fillInterior ??
      DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.fillInterior) &&
    placementBudget > 1
      ? placementBudget -
        Math.min(
          GUIDED_FILLED_OUTLINE_MAXIMUM_POINTS,
          Math.max(1, Math.round(placementBudget * 0.4)),
        )
      : 0;
  const interiorGridPoints = sampleInterior(
    cleaned,
    requestedInteriorCount,
    featureGridPoints,
  );
  const outlineBudget = placementBudget - interiorGridPoints.length;
  const perContour = allocateByWeight(
    contours.map((contour) => contour.length),
    outlineBudget,
  );
  const outlineGridPoints = contours.flatMap((contour, index) =>
    sampleContour(contour, perContour[index]),
  );
  const outlineColors = quantizeImageColors(
    outlineGridPoints.map((point) =>
      sampleOutlineColor(image, cleaned, point),
    ),
    GUIDED_OUTLINE_MAXIMUM_COLORS,
  );
  const outlinePoints = outlineGridPoints.map(transform.toSection);
  const interiorColors = quantizeImageColors(
    interiorGridPoints.map((point) =>
      sampleOutlineColor(image, cleaned, point),
    ),
    GUIDED_INTERIOR_MAXIMUM_COLORS,
  );
  const interiorPoints = interiorGridPoints.map(transform.toSection);
  const points = [...outlinePoints, ...interiorPoints, ...featurePoints].filter(
    (point) =>
      Math.hypot(point.x, point.y) <= IMAGE_PLACEMENT_SAFETY_RADIUS + 1e-9,
  );
  const colors = [
    ...outlineColors,
    ...interiorColors,
    ...featureColors,
  ].slice(0, points.length);
  return {
    colors,
    diagnostics: {
      featurePointCounts,
      interiorPointCount: interiorPoints.length,
      maskProvider: provider,
      maskRevision,
      outlinePointCount: outlinePoints.length,
      segmentation,
      totalPointCount: points.length,
    },
    mask: cleaned,
    points,
    preserveColorAssignments: true,
    warnings,
  };
}
