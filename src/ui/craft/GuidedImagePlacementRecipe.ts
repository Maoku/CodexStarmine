import type {
  GuidedImagePlacementResult,
  GuidedImagePlacementSettings,
  GuidedMaskProvider,
  GuidedPlacementMode,
  GuidedPlacementPointKind,
  ImagePrompt,
  InternalColorBoundary,
  NormalizedImagePoint,
  QuantizedSubjectMap,
  SegmentationDiagnostics,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import {
  DEFAULT_IMAGE_DERIVED_STAR_KIND,
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
    enhanceDarkColors: true,
    imageStarKind: DEFAULT_IMAGE_DERIVED_STAR_KIND,
    placementMode: "outline-internal-boundary",
    targetCount: 1024,
  };

export const GUIDED_IMAGE_MAXIMUM_COLORS = 8;
export const GUIDED_QUANTIZATION_MAXIMUM_SAMPLES = 65_536;

/*
 * Point budgets favour high-contrast internal boundaries. The floor keeps
 * faint boundaries visible while gamma widens the strong/weak gap.
 */
const INTERNAL_BOUNDARY_STRENGTH_FLOOR = 0.35;
const INTERNAL_BOUNDARY_STRENGTH_GAMMA = 1.5;
const INTERNAL_BOUNDARY_STRENGTH_MAXIMUM_SAMPLES = 256;
/*
 * Quantized label boundaries can sit a pixel or two off the real image edge.
 * Sampled points may move along the boundary normal onto the gradient peak,
 * but only for a clear improvement so exact boundaries stay put.
 */
const INTERNAL_BOUNDARY_SNAP_RADIUS_PX = 2;
const INTERNAL_BOUNDARY_SNAP_IMPROVEMENT = 1.15;
const INTERNAL_BOUNDARY_SUBEDGE_LENGTH_PX = 2;
/*
 * Within one boundary, sample density follows the local edge contrast; the
 * floor keeps soft sections sparsely covered instead of empty.
 */
const INTERNAL_BOUNDARY_LOCAL_DENSITY_FLOOR = 0.3;

interface GridPoint {
  x: number;
  y: number;
}

interface MaskSegment {
  end: GridPoint;
  start: GridPoint;
}

interface BoundarySegment {
  end: GridPoint;
  start: GridPoint;
}

interface OKLab {
  a: number;
  b: number;
  lightness: number;
}

interface ImageTransform {
  toSection(point: GridPoint): SectionPoint2D;
}

interface PlacementEntry {
  color: number;
  kind: GuidedPlacementPointKind;
  point: GridPoint;
  starId?: string;
}

export interface MaskContour {
  hole: boolean;
  length: number;
  points: GridPoint[];
}

export interface GuidedSubjectAnalysis {
  contours: MaskContour[];
  internalBoundaries: InternalColorBoundary[];
  mask: SubjectMask;
  quantizedMap: QuantizedSubjectMap;
}

export interface GuidedPlacementBudgets {
  interior: number;
  internalBoundary: number;
  outline: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function key(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function comparePoints(left: GridPoint, right: GridPoint): number {
  return left.y - right.y || left.x - right.x;
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
      return comparePoints(a, b) || left - right;
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
      comparePoints(left.points[0], right.points[0]),
  );
}

function unpackColor(color: number): {
  blue: number;
  green: number;
  red: number;
} {
  return {
    blue: color & 0xff,
    green: (color >> 8) & 0xff,
    red: (color >> 16) & 0xff,
  };
}

function packColor(red: number, green: number, blue: number): number {
  return (red << 16) | (green << 8) | blue;
}

function linearRGB(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function colorToOKLab(color: number): OKLab {
  const { blue, green, red } = unpackColor(color);
  const r = linearRGB(red);
  const g = linearRGB(green);
  const b = linearRGB(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabDistanceSquared(left: OKLab, right: OKLab): number {
  return (
    (left.lightness - right.lightness) ** 2 +
    (left.a - right.a) ** 2 +
    (left.b - right.b) ** 2
  );
}

function paletteForSamples(colors: number[], maximumColors: number): number[] {
  if (colors.length === 0) return [];
  const boxes: number[][] = [colors.map((_, index) => index)];
  const channels = ["red", "green", "blue"] as const;
  const rgb = colors.map(unpackColor);
  while (boxes.length < maximumColors) {
    let selectedBox = -1;
    let selectedChannel: (typeof channels)[number] = "red";
    let greatestRange = 0;
    boxes.forEach((indices, boxIndex) => {
      if (indices.length <= 1) return;
      channels.forEach((channel) => {
        let minimum = 255;
        let maximum = 0;
        indices.forEach((index) => {
          minimum = Math.min(minimum, rgb[index][channel]);
          maximum = Math.max(maximum, rgb[index][channel]);
        });
        const range = maximum - minimum;
        if (range > greatestRange) {
          greatestRange = range;
          selectedBox = boxIndex;
          selectedChannel = channel;
        }
      });
    });
    if (selectedBox < 0) break;
    const sorted = [...boxes[selectedBox]].sort(
      (left, right) =>
        rgb[left][selectedChannel] - rgb[right][selectedChannel] ||
        colors[left] - colors[right] ||
        left - right,
    );
    const middle = Math.ceil(sorted.length / 2);
    boxes.splice(selectedBox, 1, sorted.slice(0, middle), sorted.slice(middle));
  }
  return [
    ...new Set(
      boxes.map((indices) => {
        const divisor = Math.max(1, indices.length);
        const sum = indices.reduce(
          (value, index) => ({
            blue: value.blue + rgb[index].blue,
            green: value.green + rgb[index].green,
            red: value.red + rgb[index].red,
          }),
          { blue: 0, green: 0, red: 0 },
        );
        return packColor(
          Math.round(sum.red / divisor),
          Math.round(sum.green / divisor),
          Math.round(sum.blue / divisor),
        );
      }),
    ),
  ].sort((left, right) => left - right);
}

function nearestPaletteLabel(color: number, paletteLabs: OKLab[]): number {
  const lab = colorToOKLab(color);
  let selected = 0;
  let minimumDistance = Number.POSITIVE_INFINITY;
  paletteLabs.forEach((candidate, index) => {
    const distance = oklabDistanceSquared(lab, candidate);
    if (distance < minimumDistance) {
      minimumDistance = distance;
      selected = index;
    }
  });
  return selected;
}

export function quantizeSubjectMap(
  image: ImageDataLike,
  mask: SubjectMask,
  maximumColors = GUIDED_IMAGE_MAXIMUM_COLORS,
): QuantizedSubjectMap {
  const labels = new Uint8Array(mask.width * mask.height).fill(255);
  const foregroundIndices: number[] = [];
  for (let index = 0; index < labels.length; index += 1) {
    if (mask.data[index] && (image.data[index * 4 + 3] ?? 255) > 0) {
      foregroundIndices.push(index);
    }
  }
  if (foregroundIndices.length === 0) {
    return { height: mask.height, labels, palette: [], width: mask.width };
  }
  const stride = Math.max(
    1,
    Math.ceil(foregroundIndices.length / GUIDED_QUANTIZATION_MAXIMUM_SAMPLES),
  );
  const samples: number[] = [];
  for (let offset = 0; offset < foregroundIndices.length; offset += stride) {
    const imageOffset = foregroundIndices[offset] * 4;
    samples.push(
      packColor(
        image.data[imageOffset] ?? 0,
        image.data[imageOffset + 1] ?? 0,
        image.data[imageOffset + 2] ?? 0,
      ),
    );
  }
  const palette = paletteForSamples(
    samples,
    clamp(Math.round(maximumColors), 1, GUIDED_IMAGE_MAXIMUM_COLORS),
  );
  const paletteLabs = palette.map(colorToOKLab);
  foregroundIndices.forEach((index) => {
    const offset = index * 4;
    const color = packColor(
      image.data[offset] ?? 0,
      image.data[offset + 1] ?? 0,
      image.data[offset + 2] ?? 0,
    );
    labels[index] = nearestPaletteLabel(color, paletteLabs);
  });
  return { height: mask.height, labels, palette, width: mask.width };
}

function majorityFilterLabels(
  map: QuantizedSubjectMap,
  mask: SubjectMask,
): Uint8Array {
  const output = map.labels.slice();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      const current = map.labels[index];
      if (!mask.data[index] || current === 255) continue;
      const counts = new Uint8Array(map.palette.length);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = x + offsetX;
          const sampleY = y + offsetY;
          if (
            sampleX < 0 ||
            sampleY < 0 ||
            sampleX >= map.width ||
            sampleY >= map.height
          ) {
            continue;
          }
          const label = map.labels[sampleY * map.width + sampleX];
          if (label !== 255 && label < counts.length) counts[label] += 1;
        }
      }
      let selected = current;
      for (let label = 0; label < counts.length; label += 1) {
        if (counts[label] > counts[selected]) selected = label;
      }
      if (selected !== current && counts[selected] >= 5)
        output[index] = selected;
    }
  }
  return output;
}

function mergeSmallLabelRegions(
  labels: Uint8Array,
  map: QuantizedSubjectMap,
  mask: SubjectMask,
  featurePrompts: ImagePrompt[],
): Uint8Array {
  const output = labels.slice();
  const visited = new Uint8Array(labels.length);
  const maskArea = mask.data.reduce((sum, value) => sum + Number(value > 0), 0);
  const maximumSmallArea = Math.min(32, maskArea * 0.001);
  const protectedIndices = new Set(
    featurePrompts.map((prompt) =>
      promptIndex(prompt.point, map.width, map.height),
    ),
  );
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const;
  for (let start = 0; start < labels.length; start += 1) {
    const label = labels[start];
    if (label === 255 || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    const component: number[] = [];
    const contacts = new Map<number, number>();
    let minimumX = map.width;
    let maximumX = -1;
    let minimumY = map.height;
    let maximumY = -1;
    let protectedByPrompt = false;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      component.push(index);
      protectedByPrompt ||= protectedIndices.has(index);
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      minimumX = Math.min(minimumX, x);
      maximumX = Math.max(maximumX, x);
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y);
      directions.forEach(([offsetX, offsetY]) => {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (
          nextX < 0 ||
          nextY < 0 ||
          nextX >= map.width ||
          nextY >= map.height
        ) {
          return;
        }
        const nextIndex = nextY * map.width + nextX;
        const nextLabel = labels[nextIndex];
        if (nextLabel === label && !visited[nextIndex]) {
          visited[nextIndex] = 1;
          queue.push(nextIndex);
        } else if (nextLabel !== 255 && nextLabel !== label) {
          contacts.set(nextLabel, (contacts.get(nextLabel) ?? 0) + 1);
        }
      });
    }
    const span = Math.max(maximumX - minimumX + 1, maximumY - minimumY + 1);
    const protectedAsLongFeature =
      span >= Math.min(map.width, map.height) * 0.03;
    if (
      component.length >= maximumSmallArea ||
      protectedByPrompt ||
      protectedAsLongFeature ||
      contacts.size === 0
    ) {
      continue;
    }
    const replacement = [...contacts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0] - right[0],
    )[0][0];
    component.forEach((index) => (output[index] = replacement));
  }
  return output;
}

export function refineQuantizedSubjectMap(
  map: QuantizedSubjectMap,
  mask: SubjectMask,
  prompts: ImagePrompt[] = [],
): QuantizedSubjectMap {
  if (map.palette.length <= 1) {
    return { ...map, labels: map.labels.slice(), palette: [...map.palette] };
  }
  const majority = majorityFilterLabels(map, mask);
  const labels = mergeSmallLabelRegions(
    majority,
    map,
    mask,
    prompts.filter((prompt) => prompt.kind === "feature"),
  );
  return { ...map, labels, palette: [...map.palette] };
}

function outlineDepth(mask: SubjectMask): Int32Array {
  const distance = new Int32Array(mask.width * mask.height).fill(-1);
  const queue: number[] = [];
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const index = y * mask.width + x;
      if (!mask.data[index]) continue;
      const boundary =
        x === 0 ||
        y === 0 ||
        x === mask.width - 1 ||
        y === mask.height - 1 ||
        !mask.data[index - 1] ||
        !mask.data[index + 1] ||
        !mask.data[index - mask.width] ||
        !mask.data[index + mask.width];
      if (boundary) {
        distance[index] = 0;
        queue.push(index);
      }
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % mask.width;
    const y = Math.floor(index / mask.width);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < mask.width ? index + 1 : -1,
      y > 0 ? index - mask.width : -1,
      y + 1 < mask.height ? index + mask.width : -1,
    ];
    neighbors.forEach((next) => {
      if (next < 0 || !mask.data[next] || distance[next] >= 0) return;
      distance[next] = distance[index] + 1;
      queue.push(next);
    });
  }
  return distance;
}

function segmentOtherPoint(
  segment: BoundarySegment,
  vertex: GridPoint,
): GridPoint {
  return key(segment.start) === key(vertex) ? segment.end : segment.start;
}

function traceBoundarySegments(segments: BoundarySegment[]): GridPoint[][] {
  const adjacency = new Map<string, number[]>();
  segments.forEach((segment, index) => {
    [segment.start, segment.end].forEach((point) => {
      const indices = adjacency.get(key(point)) ?? [];
      indices.push(index);
      adjacency.set(key(point), indices);
    });
  });
  const unused = new Set(segments.map((_, index) => index));
  const paths: GridPoint[][] = [];
  while (unused.size > 0) {
    const candidateVertices = [...adjacency.entries()]
      .filter(([, indices]) => indices.some((index) => unused.has(index)))
      .map(([vertex, indices]) => ({
        point: segments[indices.find((index) => unused.has(index))!].start,
        unusedDegree: indices.filter((index) => unused.has(index)).length,
        vertex,
      }));
    const endpoint = candidateVertices
      .filter((candidate) => candidate.unusedDegree === 1)
      .sort((left, right) => {
        const [leftX, leftY] = left.vertex.split(",").map(Number);
        const [rightX, rightY] = right.vertex.split(",").map(Number);
        return leftY - rightY || leftX - rightX;
      })[0];
    const fallbackIndex = [...unused].sort((left, right) => left - right)[0];
    const fallbackSegment = segments[fallbackIndex];
    const start = endpoint
      ? (() => {
          const [x, y] = endpoint.vertex.split(",").map(Number);
          return { x, y };
        })()
      : comparePoints(fallbackSegment.start, fallbackSegment.end) <= 0
        ? fallbackSegment.start
        : fallbackSegment.end;
    const points: GridPoint[] = [{ ...start }];
    let current = start;
    let previous: GridPoint | undefined;
    while (true) {
      const candidates = (adjacency.get(key(current)) ?? []).filter((index) =>
        unused.has(index),
      );
      if (candidates.length === 0) break;
      const selected = candidates
        .map((index) => {
          const next = segmentOtherPoint(segments[index], current);
          let directionScore = 0;
          if (previous) {
            const incomingX = current.x - previous.x;
            const incomingY = current.y - previous.y;
            const outgoingX = next.x - current.x;
            const outgoingY = next.y - current.y;
            directionScore =
              (incomingX * outgoingX + incomingY * outgoingY) /
              Math.max(
                1,
                Math.hypot(incomingX, incomingY) *
                  Math.hypot(outgoingX, outgoingY),
              );
          }
          return { directionScore, index, next };
        })
        .sort(
          (left, right) =>
            right.directionScore - left.directionScore ||
            comparePoints(left.next, right.next) ||
            left.index - right.index,
        )[0];
      unused.delete(selected.index);
      previous = current;
      current = selected.next;
      points.push({ ...current });
    }
    if (points.length >= 2) paths.push(points);
  }
  return paths;
}

function pointToSegmentDistance(
  point: GridPoint,
  start: GridPoint,
  end: GridPoint,
): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const denominator = deltaX * deltaX + deltaY * deltaY;
  if (denominator === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = clamp(
    ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / denominator,
    0,
    1,
  );
  return Math.hypot(
    point.x - (start.x + deltaX * ratio),
    point.y - (start.y + deltaY * ratio),
  );
}

function simplifyOpenPolyline(points: GridPoint[], tolerance = 1): GridPoint[] {
  if (points.length <= 2) return points;
  let maximumDistance = 0;
  let maximumIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointToSegmentDistance(
      points[index],
      points[0],
      points[points.length - 1],
    );
    if (distance > maximumDistance) {
      maximumDistance = distance;
      maximumIndex = index;
    }
  }
  if (maximumDistance <= tolerance)
    return [points[0], points[points.length - 1]];
  const left = simplifyOpenPolyline(
    points.slice(0, maximumIndex + 1),
    tolerance,
  );
  const right = simplifyOpenPolyline(points.slice(maximumIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function openPolylineLength(points: GridPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
  }
  return length;
}

function sobelContrastAt(image: ImageDataLike, x: number, y: number): number {
  const channelAt = (
    sampleX: number,
    sampleY: number,
    channel: number,
  ): number => {
    const offset =
      (clamp(sampleY, 0, image.height - 1) * image.width +
        clamp(sampleX, 0, image.width - 1)) *
      4;
    const alpha = (image.data[offset + 3] ?? 255) / 255;
    return ((image.data[offset + channel] ?? 0) / 255) * alpha;
  };
  let magnitudeSquared = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    const gradientX =
      channelAt(x + 1, y - 1, channel) +
      2 * channelAt(x + 1, y, channel) +
      channelAt(x + 1, y + 1, channel) -
      channelAt(x - 1, y - 1, channel) -
      2 * channelAt(x - 1, y, channel) -
      channelAt(x - 1, y + 1, channel);
    const gradientY =
      channelAt(x - 1, y + 1, channel) +
      2 * channelAt(x, y + 1, channel) +
      channelAt(x + 1, y + 1, channel) -
      channelAt(x - 1, y - 1, channel) -
      2 * channelAt(x, y - 1, channel) -
      channelAt(x + 1, y - 1, channel);
    magnitudeSquared += gradientX ** 2 + gradientY ** 2;
  }
  return Math.sqrt(magnitudeSquared);
}

/*
 * Without the source image (unit tests, callers holding only the quantized
 * map) the palette contrast stands in for the measured gradient; both are
 * used relatively within one analysis, never mixed inside one.
 */
function boundaryStrength(
  points: GridPoint[],
  length: number,
  colorA: number,
  colorB: number,
  image?: ImageDataLike,
): number {
  if (!image) {
    return Math.sqrt(
      oklabDistanceSquared(colorToOKLab(colorA), colorToOKLab(colorB)),
    );
  }
  const samples = samplePolyline(
    points,
    length,
    clamp(Math.round(length), 1, INTERNAL_BOUNDARY_STRENGTH_MAXIMUM_SAMPLES),
  );
  if (samples.length === 0) return 0;
  const total = samples.reduce(
    (sum, point) =>
      sum + sobelContrastAt(image, Math.floor(point.x), Math.floor(point.y)),
    0,
  );
  return total / samples.length;
}

/*
 * Closed label boundaries keep their raw pixel-corner staircase; a small
 * circular moving average removes that jitter so tangents and sampled
 * positions follow the actual shape. Open paths are already simplified.
 */
function smoothClosedBoundary(points: GridPoint[]): GridPoint[] {
  if (points.length < 2 || key(points[0]) !== key(points[points.length - 1])) {
    return points;
  }
  const ring = points.slice(0, -1);
  if (ring.length < 8) return points;
  const smoothed = ring.map((current, index) => {
    const previous = ring[(index - 1 + ring.length) % ring.length];
    const next = ring[(index + 1) % ring.length];
    return {
      x: (previous.x + current.x + next.x) / 3,
      y: (previous.y + current.y + next.y) / 3,
    };
  });
  return [...smoothed, { ...smoothed[0] }];
}

function snapBoundarySample(
  image: ImageDataLike,
  mask: SubjectMask,
  point: GridPoint,
  tangent: GridPoint,
): GridPoint {
  const tangentLength = Math.hypot(tangent.x, tangent.y);
  if (tangentLength === 0) return point;
  const normalX = -tangent.y / tangentLength;
  const normalY = tangent.x / tangentLength;
  const center = INTERNAL_BOUNDARY_SNAP_RADIUS_PX;
  const magnitudes: number[] = [];
  for (let step = -center; step <= center; step += 1) {
    magnitudes.push(
      sobelContrastAt(
        image,
        Math.floor(point.x + normalX * step),
        Math.floor(point.y + normalY * step),
      ),
    );
  }
  let best = center;
  magnitudes.forEach((magnitude, index) => {
    if (magnitude > magnitudes[best]) best = index;
  });
  if (
    best === center ||
    magnitudes[best] <=
      Math.max(1 / 255, magnitudes[center] * INTERNAL_BOUNDARY_SNAP_IMPROVEMENT)
  ) {
    return point;
  }
  const shift = best - center;
  const snappedX = point.x + normalX * shift;
  const snappedY = point.y + normalY * shift;
  const maskX = clamp(Math.floor(snappedX), 0, mask.width - 1);
  const maskY = clamp(Math.floor(snappedY), 0, mask.height - 1);
  if (!mask.data[maskY * mask.width + maskX]) return point;
  return { x: snappedX, y: snappedY };
}

interface BoundarySubEdge {
  directionX: number;
  directionY: number;
  length: number;
  startX: number;
  startY: number;
  weight: number;
}

function internalBoundarySubEdges(
  points: GridPoint[],
  image?: ImageDataLike,
): BoundarySubEdge[] {
  const subEdges: BoundarySubEdge[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (edgeLength <= 0) continue;
    const directionX = (end.x - start.x) / edgeLength;
    const directionY = (end.y - start.y) / edgeLength;
    const pieces = Math.max(
      1,
      Math.ceil(edgeLength / INTERNAL_BOUNDARY_SUBEDGE_LENGTH_PX),
    );
    const pieceLength = edgeLength / pieces;
    for (let piece = 0; piece < pieces; piece += 1) {
      subEdges.push({
        directionX,
        directionY,
        length: pieceLength,
        startX: start.x + directionX * pieceLength * piece,
        startY: start.y + directionY * pieceLength * piece,
        weight: pieceLength,
      });
    }
  }
  if (!image) return subEdges;
  const strengths = subEdges.map((subEdge) =>
    sobelContrastAt(
      image,
      Math.floor(subEdge.startX + subEdge.directionX * subEdge.length * 0.5),
      Math.floor(subEdge.startY + subEdge.directionY * subEdge.length * 0.5),
    ),
  );
  const maximumStrength = strengths.reduce(
    (maximum, strength) => Math.max(maximum, strength),
    0,
  );
  if (maximumStrength <= 0) return subEdges;
  return subEdges.map((subEdge, index) => ({
    ...subEdge,
    weight:
      subEdge.length *
      (INTERNAL_BOUNDARY_LOCAL_DENSITY_FLOOR +
        (1 - INTERNAL_BOUNDARY_LOCAL_DENSITY_FLOOR) *
          (strengths[index] / maximumStrength) **
            INTERNAL_BOUNDARY_STRENGTH_GAMMA),
  }));
}

/**
 * Places `count` points along one internal boundary. With the source image
 * available, point density follows the local edge contrast and each point is
 * snapped onto the gradient peak, so the placed line concentrates on and
 * follows the real edge instead of the quantized labels.
 */
export function sampleInternalBoundary(
  boundary: InternalColorBoundary,
  count: number,
  image?: ImageDataLike,
  mask?: SubjectMask,
): GridPoint[] {
  if (count <= 0 || boundary.points.length < 2) return [];
  const subEdges = internalBoundarySubEdges(boundary.points, image);
  const totalWeight = subEdges.reduce(
    (sum, subEdge) => sum + subEdge.weight,
    0,
  );
  if (subEdges.length === 0 || totalWeight <= 0) return [];
  const result: GridPoint[] = [];
  let cursor = 0;
  let accumulated = 0;
  for (let sample = 0; sample < count; sample += 1) {
    const target = ((sample + 0.5) / count) * totalWeight;
    while (
      cursor < subEdges.length - 1 &&
      accumulated + subEdges[cursor].weight < target
    ) {
      accumulated += subEdges[cursor].weight;
      cursor += 1;
    }
    const subEdge = subEdges[cursor];
    const ratio = clamp(
      subEdge.weight > 0 ? (target - accumulated) / subEdge.weight : 0,
      0,
      1,
    );
    const point = {
      x: subEdge.startX + subEdge.directionX * subEdge.length * ratio,
      y: subEdge.startY + subEdge.directionY * subEdge.length * ratio,
    };
    result.push(
      image && mask
        ? snapBoundarySample(image, mask, point, {
            x: subEdge.directionX,
            y: subEdge.directionY,
          })
        : point,
    );
  }
  return result;
}

export function traceInternalColorBoundaries(
  map: QuantizedSubjectMap,
  mask: SubjectMask,
  prompts: ImagePrompt[] = [],
  image?: ImageDataLike,
): InternalColorBoundary[] {
  if (map.palette.length <= 1) return [];
  const depth = outlineDepth(mask);
  const groups = new Map<
    string,
    { labelA: number; labelB: number; segments: BoundarySegment[] }
  >();
  const addSegment = (
    firstIndex: number,
    secondIndex: number,
    start: GridPoint,
    end: GridPoint,
  ): void => {
    const first = map.labels[firstIndex];
    const second = map.labels[secondIndex];
    if (
      first === 255 ||
      second === 255 ||
      first === second ||
      depth[firstIndex] <= 1 ||
      depth[secondIndex] <= 1
    ) {
      return;
    }
    const labelA = Math.min(first, second);
    const labelB = Math.max(first, second);
    const pairKey = `${labelA}:${labelB}`;
    const group = groups.get(pairKey) ?? { labelA, labelB, segments: [] };
    group.segments.push({ start, end });
    groups.set(pairKey, group);
  };
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      if (x + 1 < map.width) {
        addSegment(index, index + 1, { x: x + 1, y }, { x: x + 1, y: y + 1 });
      }
      if (y + 1 < map.height) {
        addSegment(
          index,
          index + map.width,
          { x, y: y + 1 },
          { x: x + 1, y: y + 1 },
        );
      }
    }
  }
  const minimumLength = Math.min(map.width, map.height) * 0.02;
  const protectedDistance = Math.min(map.width, map.height) * 0.02;
  const featurePoints = prompts
    .filter((prompt) => prompt.kind === "feature")
    .map((prompt) => ({
      x: prompt.point.x * map.width,
      y: prompt.point.y * map.height,
    }));
  const boundaries: InternalColorBoundary[] = [];
  [...groups.values()]
    .sort(
      (left, right) => left.labelA - right.labelA || left.labelB - right.labelB,
    )
    .forEach((group) => {
      traceBoundarySegments(group.segments).forEach((rawPoints) => {
        const closed =
          key(rawPoints[0]) === key(rawPoints[rawPoints.length - 1]);
        const points = closed
          ? smoothClosedBoundary(rawPoints)
          : simplifyOpenPolyline(rawPoints, 1);
        const length = openPolylineLength(points);
        const protectedByFeature = featurePoints.some((feature) =>
          points.some(
            (point) =>
              Math.hypot(point.x - feature.x, point.y - feature.y) <=
              protectedDistance,
          ),
        );
        if (length < minimumLength && !protectedByFeature) return;
        boundaries.push({
          colorA: map.palette[group.labelA],
          colorB: map.palette[group.labelB],
          length,
          points,
          strength: boundaryStrength(
            points,
            length,
            map.palette[group.labelA],
            map.palette[group.labelB],
            image,
          ),
        });
      });
    });
  return boundaries.sort(
    (left, right) =>
      left.colorA - right.colorA ||
      left.colorB - right.colorB ||
      comparePoints(left.points[0], right.points[0]) ||
      right.length - left.length,
  );
}

export function analyzeGuidedSubject(
  image: ImageDataLike,
  mask: SubjectMask,
  prompts: ImagePrompt[],
  onStage?: (stage: "quantizing-colors" | "tracing-boundaries") => void,
): GuidedSubjectAnalysis {
  const cleaned = cleanSubjectMask(mask, prompts);
  const contours = traceMaskContours(cleaned);
  onStage?.("quantizing-colors");
  const quantizedMap = refineQuantizedSubjectMap(
    quantizeSubjectMap(image, cleaned),
    cleaned,
    prompts,
  );
  onStage?.("tracing-boundaries");
  const internalBoundaries = traceInternalColorBoundaries(
    quantizedMap,
    cleaned,
    prompts,
    image,
  );
  return { contours, internalBoundaries, mask: cleaned, quantizedMap };
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

function samplePolyline(
  points: GridPoint[],
  length: number,
  count: number,
): GridPoint[] {
  if (count <= 0 || points.length < 2 || length <= 0) return [];
  const edgeLengths = points
    .slice(1)
    .map((point, index) =>
      Math.hypot(point.x - points[index].x, point.y - points[index].y),
    );
  const result: GridPoint[] = [];
  for (let sample = 0; sample < count; sample += 1) {
    let target = ((sample + 0.5) / count) * length;
    let edge = 0;
    while (edge < edgeLengths.length - 1 && target > edgeLengths[edge]) {
      target -= edgeLengths[edge];
      edge += 1;
    }
    const start = points[edge];
    const end = points[edge + 1];
    const ratio = edgeLengths[edge] > 0 ? target / edgeLengths[edge] : 0;
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

function sampleInterior(
  mask: SubjectMask,
  count: number,
  excluded: GridPoint[],
): GridPoint[] {
  if (count <= 0) return [];
  const forbidden = new Uint8Array(mask.width * mask.height);
  excluded.forEach((point) => {
    for (let y = Math.floor(point.y - 2); y <= Math.ceil(point.y + 2); y += 1) {
      for (
        let x = Math.floor(point.x - 2);
        x <= Math.ceil(point.x + 2);
        x += 1
      ) {
        if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) continue;
        if (Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) < 2) {
          forbidden[y * mask.width + x] = 1;
        }
      }
    }
  });
  const candidates: number[] = [];
  let maximumX = -1;
  let maximumY = -1;
  let minimumX = mask.width;
  let minimumY = mask.height;
  for (let y = 1; y < mask.height - 1; y += 1) {
    for (let x = 1; x < mask.width - 1; x += 1) {
      const index = y * mask.width + x;
      if (!interiorPixel(mask, x, y) || forbidden[index]) continue;
      candidates.push(index);
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
  if (weights.length === 0 || total <= 0) return weights.map(() => 0);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightTotal <= 0) return weights.map(() => 0);
  const counts = weights.map((weight) =>
    Math.floor((weight / weightTotal) * total),
  );
  const fractions = weights.map((weight, index) => ({
    fraction: (weight / weightTotal) * total - counts[index],
    index,
  }));
  let remaining = total - counts.reduce((sum, count) => sum + count, 0);
  fractions
    .sort(
      (left, right) =>
        right.fraction - left.fraction || left.index - right.index,
    )
    .forEach(({ index }) => {
      if (remaining <= 0) return;
      counts[index] += 1;
      remaining -= 1;
    });
  return counts;
}

/*
 * Length-proportional budgets give every boundary the same point density,
 * flattening strong and weak edges alike. Scaling length by relative
 * strength concentrates points on crisp boundaries while the floor keeps
 * faint ones present.
 */
export function internalBoundaryWeights(
  boundaries: InternalColorBoundary[],
): number[] {
  const maximumStrength = boundaries.reduce(
    (maximum, boundary) => Math.max(maximum, boundary.strength),
    0,
  );
  if (maximumStrength <= 0) {
    return boundaries.map((boundary) => boundary.length);
  }
  return boundaries.map(
    (boundary) =>
      boundary.length *
      (INTERNAL_BOUNDARY_STRENGTH_FLOOR +
        (1 - INTERNAL_BOUNDARY_STRENGTH_FLOOR) *
          (boundary.strength / maximumStrength) **
            INTERNAL_BOUNDARY_STRENGTH_GAMMA),
  );
}

export function allocateGuidedPlacementBudgets(
  mode: GuidedPlacementMode,
  total: number,
  hasInternalBoundary: boolean,
): GuidedPlacementBudgets {
  const normalizedTotal = Math.max(0, Math.round(total));
  if (mode === "outline") {
    return { interior: 0, internalBoundary: 0, outline: normalizedTotal };
  }
  const weights =
    mode === "outline-internal-boundary-filled"
      ? hasInternalBoundary
        ? [0.3, 0.4, 0.3]
        : [0.42, 0, 0.58]
      : hasInternalBoundary
        ? [0.45, 0.55, 0]
        : [1, 0, 0];
  const [outline, internalBoundary, interior] = allocateByWeight(
    weights,
    normalizedTotal,
  );
  return { interior, internalBoundary, outline };
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

function representativeColor(image: ImageDataLike, indices: number[]): number {
  if (indices.length === 0) return 0xffffff;
  const colors: number[] = [];
  const stride = Math.max(1, Math.ceil(indices.length / 4096));
  for (let offset = 0; offset < indices.length; offset += stride) {
    const index = indices[offset] * 4;
    colors.push(
      packColor(
        image.data[index] ?? 0,
        image.data[index + 1] ?? 0,
        image.data[index + 2] ?? 0,
      ),
    );
  }
  return quantizeImageColors(colors, 1)[0] ?? 0xffffff;
}

function sampleOutlineColor(
  image: ImageDataLike,
  mask: SubjectMask,
  point: GridPoint,
): number {
  const maskIndices: number[] = [];
  for (let y = Math.floor(point.y - 2); y <= point.y + 2; y += 1) {
    for (let x = Math.floor(point.x - 2); x <= point.x + 2; x += 1) {
      if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) continue;
      if (Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) > 2) continue;
      const maskIndex = y * mask.width + x;
      if (mask.data[maskIndex]) maskIndices.push(maskIndex);
    }
  }
  return representativeColor(image, maskIndices);
}

function sampleFeature(
  image: ImageDataLike,
  mask: SubjectMask,
  prompt: ImagePrompt,
): { color: number; point: GridPoint } {
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
      if (mask.data[index]) localIndices.push(index);
    }
  }
  return {
    color: representativeColor(image, localIndices),
    point: { x: centerX, y: centerY },
  };
}

function paletteColorAtPoint(
  map: QuantizedSubjectMap,
  point: GridPoint,
): number {
  const x = clamp(Math.floor(point.x), 0, map.width - 1);
  const y = clamp(Math.floor(point.y), 0, map.height - 1);
  const label = map.labels[y * map.width + x];
  return label === 255
    ? (map.palette[0] ?? 0xffffff)
    : (map.palette[label] ?? 0xffffff);
}

function nearestPaletteColor(color: number, palette: number[]): number {
  if (palette.length === 0) return color;
  const lab = colorToOKLab(color);
  return palette
    .map((candidate) => ({
      candidate,
      distance: oklabDistanceSquared(lab, colorToOKLab(candidate)),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance || left.candidate - right.candidate,
    )[0].candidate;
}

function emptyPlacement(
  analysis: GuidedSubjectAnalysis,
  settings: GuidedImagePlacementSettings,
  provider: GuidedMaskProvider,
  maskRevision: number,
  segmentation: SegmentationDiagnostics | undefined,
  warnings: string[],
): GuidedImagePlacementResult {
  return {
    colors: [],
    diagnostics: {
      featurePointCounts: {},
      interiorPointCount: 0,
      internalBoundaryCount: analysis.internalBoundaries.length,
      internalBoundaryPointCount: 0,
      maskProvider: provider,
      maskRevision,
      outlinePointCount: 0,
      paletteColorCount: analysis.quantizedMap.palette.length,
      segmentation,
      totalPointCount: 0,
    },
    enhanceDarkColors: settings.enhanceDarkColors,
    imageStarKind: settings.imageStarKind,
    mask: analysis.mask,
    pointKinds: [],
    points: [],
    preserveColorAssignments: true,
    starIds: [],
    warnings,
  };
}

export function createGuidedImagePlacementFromAnalysis(
  image: ImageDataLike,
  analysis: GuidedSubjectAnalysis,
  prompts: ImagePrompt[],
  partialSettings: Partial<GuidedImagePlacementSettings> = {},
  provider: GuidedMaskProvider = "fast",
  maskRevision = 0,
  segmentation?: SegmentationDiagnostics,
): GuidedImagePlacementResult {
  const settings: GuidedImagePlacementSettings = {
    ...DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS,
    ...partialSettings,
    targetCount: Math.round(
      clamp(
        partialSettings.targetCount ??
          DEFAULT_GUIDED_IMAGE_PLACEMENT_SETTINGS.targetCount,
        IMAGE_PLACEMENT_MINIMUM_POINTS,
        IMAGE_PLACEMENT_MAXIMUM_POINTS,
      ),
    ),
  };
  const warnings: string[] = [];
  const transform = imageTransform(analysis.mask);
  if (!transform || analysis.contours.length === 0) {
    return emptyPlacement(
      analysis,
      settings,
      provider,
      maskRevision,
      segmentation,
      warnings,
    );
  }

  const featureEntries: PlacementEntry[] = [];
  const featurePointCounts: Record<string, number> = {};
  prompts
    .filter((prompt) => prompt.kind === "feature")
    .forEach((prompt) => {
      const inside =
        analysis.mask.data[
          promptIndex(prompt.point, analysis.mask.width, analysis.mask.height)
        ];
      if (!inside) {
        warnings.push(`特徴点「${prompt.id}」は被写体の外側です。`);
        featurePointCounts[prompt.id] = 0;
        return;
      }
      const sampled = sampleFeature(image, analysis.mask, prompt);
      featureEntries.push({
        color: nearestPaletteColor(
          sampled.color,
          analysis.quantizedMap.palette,
        ),
        kind: "feature",
        point: sampled.point,
      });
      featurePointCounts[prompt.id] = 1;
    });

  const placementBudget = Math.max(
    0,
    settings.targetCount - featureEntries.length,
  );
  let budgets = allocateGuidedPlacementBudgets(
    settings.placementMode,
    placementBudget,
    analysis.internalBoundaries.length > 0,
  );
  let outlineCounts = allocateByWeight(
    analysis.contours.map((contour) => contour.length),
    budgets.outline,
  );
  const boundaryWeights = internalBoundaryWeights(analysis.internalBoundaries);
  let boundaryCounts = allocateByWeight(
    boundaryWeights,
    budgets.internalBoundary,
  );
  let outlineGridPoints = analysis.contours.flatMap((contour, index) =>
    sampleContour(contour, outlineCounts[index]),
  );
  let boundarySamples = analysis.internalBoundaries.flatMap(
    (boundary, boundaryIndex) =>
      sampleInternalBoundary(
        boundary,
        boundaryCounts[boundaryIndex],
        image,
        analysis.mask,
      ).map((point, pointIndex) => ({
        boundary,
        boundaryIndex,
        point,
        pointIndex,
      })),
  );
  const featureGridPoints = featureEntries.map((entry) => entry.point);
  const interiorGridPoints = sampleInterior(analysis.mask, budgets.interior, [
    ...outlineGridPoints,
    ...boundarySamples.map((sample) => sample.point),
    ...featureGridPoints,
  ]);
  const interiorDeficit = budgets.interior - interiorGridPoints.length;
  if (interiorDeficit > 0) {
    if (analysis.internalBoundaries.length > 0) {
      budgets = {
        ...budgets,
        internalBoundary: budgets.internalBoundary + interiorDeficit,
      };
      boundaryCounts = allocateByWeight(
        boundaryWeights,
        budgets.internalBoundary,
      );
      boundarySamples = analysis.internalBoundaries.flatMap(
        (boundary, boundaryIndex) =>
          sampleInternalBoundary(
            boundary,
            boundaryCounts[boundaryIndex],
            image,
            analysis.mask,
          ).map((point, pointIndex) => ({
            boundary,
            boundaryIndex,
            point,
            pointIndex,
          })),
      );
    } else {
      budgets = { ...budgets, outline: budgets.outline + interiorDeficit };
      outlineCounts = allocateByWeight(
        analysis.contours.map((contour) => contour.length),
        budgets.outline,
      );
      outlineGridPoints = analysis.contours.flatMap((contour, index) =>
        sampleContour(contour, outlineCounts[index]),
      );
    }
  }

  const selectedOutlineStar = settings.outlineStar;
  const outlineStar =
    selectedOutlineStar &&
    selectedOutlineStar.starId.length > 0 &&
    Number.isInteger(selectedOutlineStar.color) &&
    selectedOutlineStar.color >= 0 &&
    selectedOutlineStar.color <= 0xffffff
      ? selectedOutlineStar
      : undefined;
  const fallbackOutlineColor =
    quantizeImageColors(
      outlineGridPoints.map((point) =>
        sampleOutlineColor(image, analysis.mask, point),
      ),
      1,
    )[0] ?? 0xffffff;
  const outlineEntries: PlacementEntry[] = outlineGridPoints.map((point) => ({
    color: outlineStar?.color ?? fallbackOutlineColor,
    kind: "outline",
    point,
    starId: outlineStar?.starId,
  }));
  const boundaryEntries: PlacementEntry[] = boundarySamples.map(
    ({ boundary, boundaryIndex, point, pointIndex }) => {
      const startOffset =
        (boundary.colorA +
          boundary.colorB +
          boundaryIndex +
          Math.round(boundary.points[0].x * 17 + boundary.points[0].y * 31)) &
        1;
      return {
        color:
          (pointIndex + startOffset) % 2 === 0
            ? boundary.colorA
            : boundary.colorB,
        kind: "internal-boundary" as const,
        point,
      };
    },
  );
  const interiorEntries: PlacementEntry[] = interiorGridPoints.map((point) => ({
    color: paletteColorAtPoint(analysis.quantizedMap, point),
    kind: "interior",
    point,
  }));
  const entries = [
    ...outlineEntries,
    ...boundaryEntries,
    ...interiorEntries,
    ...featureEntries,
  ].filter((entry) => {
    const point = transform.toSection(entry.point);
    return Math.hypot(point.x, point.y) <= IMAGE_PLACEMENT_SAFETY_RADIUS + 1e-9;
  });
  const points = entries.map((entry) => transform.toSection(entry.point));
  const pointKinds = entries.map((entry) => entry.kind);
  return {
    colors: entries.map((entry) => entry.color),
    diagnostics: {
      featurePointCounts,
      interiorPointCount: pointKinds.filter((kind) => kind === "interior")
        .length,
      internalBoundaryCount: analysis.internalBoundaries.length,
      internalBoundaryPointCount: pointKinds.filter(
        (kind) => kind === "internal-boundary",
      ).length,
      maskProvider: provider,
      maskRevision,
      outlinePointCount: pointKinds.filter((kind) => kind === "outline").length,
      paletteColorCount: analysis.quantizedMap.palette.length,
      segmentation,
      totalPointCount: points.length,
    },
    enhanceDarkColors: settings.enhanceDarkColors,
    imageStarKind: settings.imageStarKind,
    mask: analysis.mask,
    pointKinds,
    points,
    preserveColorAssignments: true,
    starIds: entries.map((entry) => entry.starId),
    warnings,
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
  const analysis = analyzeGuidedSubject(image, mask, prompts);
  return createGuidedImagePlacementFromAnalysis(
    image,
    analysis,
    prompts,
    settings,
    provider,
    maskRevision,
    segmentation,
  );
}
