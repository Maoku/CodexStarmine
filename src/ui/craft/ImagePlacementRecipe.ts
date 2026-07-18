import type { VirtualStarPreset } from "../../data";
import type { SectionPoint2D } from "./SliceGeometry";

export interface ImageDataLike {
  data: ArrayLike<number>;
  height: number;
  width: number;
}

export interface ImagePlacementSettings {
  maximumColors: number;
  targetCount: number;
}

export interface ImagePlacementResult {
  colors: number[];
  points: SectionPoint2D[];
  /** The recipe already assigned a bounded palette and its point membership. */
  preserveColorAssignments?: boolean;
}

export interface ImageStarResolution {
  createdStarIds: string[];
  starDefinitions: Record<string, VirtualStarPreset>;
  starIds: string[];
}

export interface ResolveImageStarsOptions {
  maximumColors?: number;
  preserveColorAssignments?: boolean;
}

export const DEFAULT_IMAGE_PLACEMENT_SETTINGS: ImagePlacementSettings = {
  maximumColors: 4,
  targetCount: 240,
};

export const IMAGE_PLACEMENT_MAXIMUM_POINTS = 1024;
export const IMAGE_PLACEMENT_MINIMUM_POINTS = 8;
export const IMAGE_PLACEMENT_SAFETY_RADIUS = 0.94;

const BACKGROUND_DIFFERENCE_THRESHOLD = 24;
const EDGE_SCORE_RELATIVE_THRESHOLD = 0.14;
/* One 8-bit intensity step; below this a Sobel response is float noise. */
const FEATURE_EDGE_MINIMUM = 1 / 255;
const CONTOUR_RIM_THICKNESS_PX = 2;
/* Share of the target count reserved for interior features such as eyes. */
const FEATURE_BUDGET_RATIO = 0.25;
/*
 * Subject components are scored by accumulated background contrast. Anything
 * far below the main subject (wall shading strips, detached scraps) is noise
 * that would waste contour budget and blur the placed shape.
 */
const COMPONENT_SCORE_RATIO = 0.15;

interface RGB {
  blue: number;
  green: number;
  red: number;
}

interface PixelCandidate extends RGB {
  color: number;
  importance: number;
  index: number;
  point: SectionPoint2D;
}

interface ColorEntry extends RGB {
  color: number;
  index: number;
}

interface ColorCluster {
  entries: ColorEntry[];
  representative: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle];
  return Math.round((values[middle - 1] + values[middle]) / 2);
}

function rgb(color: number): RGB {
  return {
    blue: color & 0xff,
    green: (color >> 8) & 0xff,
    red: (color >> 16) & 0xff,
  };
}

function packColor({ blue, green, red }: RGB): number {
  return (red << 16) | (green << 8) | blue;
}

function colorDistance(left: number, right: number): number {
  const a = rgb(left);
  const b = rgb(right);
  return Math.hypot(a.red - b.red, a.green - b.green, a.blue - b.blue);
}

function borderPixelIndices(width: number, height: number): number[] {
  const indices: number[] = [];
  for (let x = 0; x < width; x += 1) {
    indices.push(x);
    if (height > 1) indices.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    indices.push(y * width);
    if (width > 1) indices.push(y * width + width - 1);
  }
  return indices;
}

function backgroundColor(image: ImageDataLike): RGB & { alpha: number } {
  const channels = {
    alpha: [] as number[],
    blue: [] as number[],
    green: [] as number[],
    red: [] as number[],
  };
  borderPixelIndices(image.width, image.height).forEach((pixelIndex) => {
    const offset = pixelIndex * 4;
    channels.red.push(image.data[offset] ?? 0);
    channels.green.push(image.data[offset + 1] ?? 0);
    channels.blue.push(image.data[offset + 2] ?? 0);
    channels.alpha.push(image.data[offset + 3] ?? 0);
  });
  return {
    alpha: median(channels.alpha),
    blue: median(channels.blue),
    green: median(channels.green),
    red: median(channels.red),
  };
}

function sobelMagnitude(
  field: Float64Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const at = (sampleX: number, sampleY: number): number =>
    field[clamp(sampleY, 0, height - 1) * width + clamp(sampleX, 0, width - 1)];
  const gradientX =
    at(x + 1, y - 1) +
    2 * at(x + 1, y) +
    at(x + 1, y + 1) -
    at(x - 1, y - 1) -
    2 * at(x - 1, y) -
    at(x - 1, y + 1);
  const gradientY =
    at(x - 1, y + 1) +
    2 * at(x, y + 1) +
    at(x + 1, y + 1) -
    at(x - 1, y - 1) -
    2 * at(x, y - 1) -
    at(x + 1, y - 1);
  return Math.hypot(gradientX, gradientY);
}

interface ImageAnalysis {
  featureCandidates: PixelCandidate[];
  pixelScale: number;
  silhouetteCandidates: PixelCandidate[];
  subjectColors: number[];
}

/**
 * Builds the subject mask and returns its boundary pixels plus interior
 * feature edges (eyes, markings). The background is the border-connected
 * region of pixels close to the border color, so subject areas that share the
 * background color (a white shirt on white) stay part of the mask as long as
 * they are enclosed.
 */
function analyzeImage(image: ImageDataLike): ImageAnalysis {
  const background = backgroundColor(image);
  const pixelScale =
    (IMAGE_PLACEMENT_SAFETY_RADIUS * 2) / Math.hypot(image.width, image.height);
  const size = image.width * image.height;
  const strength = new Float64Array(size);
  const channels = {
    blue: new Float64Array(size),
    green: new Float64Array(size),
    red: new Float64Array(size),
  };
  let maximumStrength = 0;

  for (let index = 0; index < size; index += 1) {
    const offset = index * 4;
    const red = image.data[offset] ?? 0;
    const green = image.data[offset + 1] ?? 0;
    const blue = image.data[offset + 2] ?? 0;
    const alpha = image.data[offset + 3] ?? 0;
    const rgbDifference = Math.hypot(
      red - background.red,
      green - background.green,
      blue - background.blue,
    );
    const alphaDifference = Math.abs(alpha - background.alpha);
    strength[index] =
      background.alpha < 16
        ? alpha
        : rgbDifference * (alpha / 255) + alphaDifference;
    maximumStrength = Math.max(maximumStrength, strength[index]);
    const opacity = alpha / 255;
    channels.red[index] = (red / 255) * opacity;
    channels.green[index] = (green / 255) * opacity;
    channels.blue[index] = (blue / 255) * opacity;
  }
  if (maximumStrength <= 0) {
    return {
      featureCandidates: [],
      pixelScale,
      silhouetteCandidates: [],
      subjectColors: [],
    };
  }
  const backgroundThreshold = Math.max(
    BACKGROUND_DIFFERENCE_THRESHOLD,
    maximumStrength * 0.08,
  );

  const flooded = new Uint8Array(size);
  const queue: number[] = [];
  borderPixelIndices(image.width, image.height).forEach((index) => {
    if (!flooded[index] && strength[index] < backgroundThreshold) {
      flooded[index] = 1;
      queue.push(index);
    }
  });
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    const x = index % image.width;
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x < image.width - 1 ? index + 1 : -1,
      index - image.width,
      index + image.width,
    ];
    neighbors.forEach((neighbor) => {
      if (
        neighbor >= 0 &&
        neighbor < size &&
        !flooded[neighbor] &&
        strength[neighbor] < backgroundThreshold
      ) {
        flooded[neighbor] = 1;
        queue.push(neighbor);
      }
    });
  }

  const componentLabels = new Int32Array(size).fill(-1);
  const componentScores: number[] = [];
  for (let start = 0; start < size; start += 1) {
    if (flooded[start] || componentLabels[start] >= 0) continue;
    const label = componentScores.length;
    componentLabels[start] = label;
    const stack = [start];
    let score = 0;
    for (let head = 0; head < stack.length; head += 1) {
      const index = stack[head];
      score += strength[index];
      const x = index % image.width;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < image.width - 1 ? index + 1 : -1,
        index - image.width,
        index + image.width,
      ];
      neighbors.forEach((neighbor) => {
        if (
          neighbor >= 0 &&
          neighbor < size &&
          !flooded[neighbor] &&
          componentLabels[neighbor] < 0
        ) {
          componentLabels[neighbor] = label;
          stack.push(neighbor);
        }
      });
    }
    componentScores.push(score);
  }
  const bestComponentScore = componentScores.reduce(
    (best, score) => Math.max(best, score),
    0,
  );
  const keptComponents = componentScores.map(
    (score) => score >= bestComponentScore * COMPONENT_SCORE_RATIO,
  );

  /* The image crop line is not a subject contour, so borders stay neutral. */
  const isBackground = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < image.width &&
    y < image.height &&
    flooded[y * image.width + x] === 1;
  const isKeptSubject = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
    const index = y * image.width + x;
    return flooded[index] === 0 && keptComponents[componentLabels[index]];
  };
  const centerX = image.width / 2;
  const centerY = image.height / 2;
  const candidateAt = (
    x: number,
    y: number,
    importance: number,
  ): PixelCandidate => {
    const index = y * image.width + x;
    const offset = index * 4;
    const red = image.data[offset] ?? 0;
    const green = image.data[offset + 1] ?? 0;
    const blue = image.data[offset + 2] ?? 0;
    return {
      blue,
      color: packColor({ blue, green, red }),
      green,
      importance,
      index,
      point: {
        x: (x + 0.5 - centerX) * pixelScale,
        y: (centerY - (y + 0.5)) * pixelScale,
      },
      red,
    };
  };

  const silhouetteCandidates: PixelCandidate[] = [];
  const scoredFeatures: PixelCandidate[] = [];
  const subjectColors: number[] = [];
  let maximumFeature = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isKeptSubject(x, y)) continue;
      const colorOffset = (y * image.width + x) * 4;
      subjectColors.push(
        packColor({
          blue: image.data[colorOffset + 2] ?? 0,
          green: image.data[colorOffset + 1] ?? 0,
          red: image.data[colorOffset] ?? 0,
        }),
      );
      if (
        isBackground(x - 1, y) ||
        isBackground(x + 1, y) ||
        isBackground(x, y - 1) ||
        isBackground(x, y + 1)
      ) {
        silhouetteCandidates.push(candidateAt(x, y, 1));
        continue;
      }
      let interior = true;
      for (let stepY = -1; stepY <= 1 && interior; stepY += 1) {
        for (let stepX = -1; stepX <= 1; stepX += 1) {
          if (isBackground(x + stepX, y + stepY)) {
            interior = false;
            break;
          }
        }
      }
      if (!interior) continue;
      const featureEdge = Math.hypot(
        sobelMagnitude(channels.red, image.width, image.height, x, y),
        sobelMagnitude(channels.green, image.width, image.height, x, y),
        sobelMagnitude(channels.blue, image.width, image.height, x, y),
      );
      if (featureEdge < FEATURE_EDGE_MINIMUM) continue;
      maximumFeature = Math.max(maximumFeature, featureEdge);
      scoredFeatures.push(candidateAt(x, y, featureEdge));
    }
  }

  const featureThreshold = Math.max(
    maximumFeature * EDGE_SCORE_RELATIVE_THRESHOLD,
    FEATURE_EDGE_MINIMUM,
  );
  return {
    featureCandidates: scoredFeatures
      .filter((candidate) => candidate.importance >= featureThreshold)
      .sort(
        (left, right) =>
          right.importance - left.importance || left.index - right.index,
      ),
    pixelScale,
    silhouetteCandidates,
    subjectColors,
  };
}

function evenPick(
  candidates: PixelCandidate[],
  budget: number,
): PixelCandidate[] {
  if (candidates.length <= budget) return candidates;
  return Array.from(
    { length: budget },
    (_, index) => candidates[Math.floor((index * candidates.length) / budget)],
  );
}

function sampleCandidates(
  candidates: PixelCandidate[],
  budget: number,
  initialDistance: number,
  seeds: PixelCandidate[],
): PixelCandidate[] {
  if (budget <= 0) return [];
  const seedIndices = new Set(seeds.map((seed) => seed.index));
  const available = candidates.filter(
    (candidate) => !seedIndices.has(candidate.index),
  );
  if (available.length <= budget) return available;

  for (const distanceScale of [1, 0.84, 0.7, 0.56, 0.42, 0]) {
    const minimumDistance = initialDistance * distanceScale;
    if (minimumDistance === 0) return evenPick(available, budget);
    const selected: PixelCandidate[] = [];
    const blockers = [...seeds];
    for (const candidate of available) {
      if (
        blockers.every(
          (item) =>
            Math.hypot(
              item.point.x - candidate.point.x,
              item.point.y - candidate.point.y,
            ) >= minimumDistance,
        )
      ) {
        selected.push(candidate);
        blockers.push(candidate);
      }
    }
    if (selected.length >= budget) return evenPick(selected, budget);
  }
  return [];
}

/** The subject's most common color, used to paint the whole outline evenly. */
function dominantColor(colors: number[]): number | undefined {
  if (colors.length === 0) return undefined;
  const clusters = quantizeColors(colors, 4);
  return clusters.reduce((best, cluster) =>
    cluster.entries.length > best.entries.length ? cluster : best,
  ).representative;
}

export function extractImagePlacement(
  image: ImageDataLike,
  settings: Partial<ImagePlacementSettings> = {},
): ImagePlacementResult {
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.width <= 0 ||
    image.height <= 0 ||
    image.data.length < image.width * image.height * 4
  ) {
    return { colors: [], points: [] };
  }
  const targetCount = Math.round(
    clamp(
      settings.targetCount ?? DEFAULT_IMAGE_PLACEMENT_SETTINGS.targetCount,
      IMAGE_PLACEMENT_MINIMUM_POINTS,
      IMAGE_PLACEMENT_MAXIMUM_POINTS,
    ),
  );
  const { featureCandidates, pixelScale, silhouetteCandidates, subjectColors } =
    analyzeImage(image);
  const silhouetteLength = silhouetteCandidates.length * pixelScale;

  const silhouetteBudget =
    targetCount - Math.floor(targetCount * FEATURE_BUDGET_RATIO);
  const silhouette = sampleCandidates(
    silhouetteCandidates,
    silhouetteBudget,
    Math.max(pixelScale, silhouetteLength / Math.max(silhouetteBudget, 1)),
    [],
  );

  const featureBudget = targetCount - silhouette.length;
  const featureLength =
    (featureCandidates.length * pixelScale) / CONTOUR_RIM_THICKNESS_PX;
  const features = sampleCandidates(
    featureCandidates,
    featureBudget,
    Math.max(pixelScale, featureLength / Math.max(featureBudget, 1)),
    silhouette,
  );

  const backfillBudget = targetCount - silhouette.length - features.length;
  const outline =
    backfillBudget > 0
      ? [
          ...silhouette,
          ...sampleCandidates(
            silhouetteCandidates,
            backfillBudget,
            Math.max(pixelScale, silhouetteLength / targetCount),
            [...silhouette, ...features],
          ),
        ]
      : silhouette;

  const outlineColor = dominantColor(subjectColors) ?? 0xffffff;
  return {
    colors: [
      ...outline.map(() => outlineColor),
      ...features.map((candidate) => candidate.color),
    ],
    points: [...outline, ...features].map((candidate) => candidate.point),
  };
}

function channelRange(entries: ColorEntry[], channel: keyof RGB): number {
  const values = entries.map((entry) => entry[channel]);
  return Math.max(...values) - Math.min(...values);
}

function representative(entries: ColorEntry[]): number {
  return packColor({
    blue: Math.round(
      entries.reduce((sum, entry) => sum + entry.blue, 0) / entries.length,
    ),
    green: Math.round(
      entries.reduce((sum, entry) => sum + entry.green, 0) / entries.length,
    ),
    red: Math.round(
      entries.reduce((sum, entry) => sum + entry.red, 0) / entries.length,
    ),
  });
}

function quantizeColors(
  colors: number[],
  maximumColors: number,
): ColorCluster[] {
  if (colors.length === 0) return [];
  const boxes: ColorEntry[][] = [
    colors.map((color, index) => ({ ...rgb(color), color, index })),
  ];
  const channels = ["red", "green", "blue"] as const;

  while (boxes.length < maximumColors) {
    let splitIndex = -1;
    let splitChannel: (typeof channels)[number] = "red";
    let greatestRange = 0;
    boxes.forEach((entries, index) => {
      channels.forEach((channel) => {
        const range = channelRange(entries, channel);
        if (entries.length > 1 && range > greatestRange) {
          greatestRange = range;
          splitIndex = index;
          splitChannel = channel;
        }
      });
    });
    if (splitIndex < 0) break;
    const entries = [...boxes[splitIndex]].sort(
      (left, right) =>
        left[splitChannel] - right[splitChannel] ||
        left.color - right.color ||
        left.index - right.index,
    );
    const middle = Math.ceil(entries.length / 2);
    boxes.splice(
      splitIndex,
      1,
      entries.slice(0, middle),
      entries.slice(middle),
    );
  }

  return boxes.map((entries) => ({
    entries,
    representative: representative(entries),
  }));
}

/** Assigns every input color to one of at most `maximumColors` representatives. */
export function quantizeImageColors(
  colors: number[],
  maximumColors: number,
): number[] {
  const clusters = quantizeColors(
    colors,
    Math.max(1, Math.round(maximumColors)),
  );
  const result = Array.from({ length: colors.length }, () => 0xffffff);
  clusters.forEach((cluster) => {
    cluster.entries.forEach((entry) => {
      result[entry.index] = cluster.representative;
    });
  });
  return result;
}

function exactColorClusters(colors: number[]): ColorCluster[] {
  const byColor = new Map<number, ColorEntry[]>();
  colors.forEach((color, index) => {
    const entries = byColor.get(color) ?? [];
    entries.push({ ...rgb(color), color, index });
    byColor.set(color, entries);
  });
  return [...byColor.entries()].map(([color, entries]) => ({
    entries,
    representative: color,
  }));
}

/*
 * A dark RGB sample is a poor target for an emissive firework. Brighten it
 * while retaining its hue; nearly neutral samples become a cool silver so
 * black and gray outlines remain visible against the night sky.
 */
function visibleFireworkColor(color: number): number {
  const channels = rgb(color);
  const maximum = Math.max(channels.red, channels.green, channels.blue);
  const minimum = Math.min(channels.red, channels.green, channels.blue);
  if (maximum - minimum <= 24 && maximum < 210) return 0xd8e8f2;
  if (maximum >= 176) return color;
  if (maximum <= 0) return 0xd8e8f2;
  const scale = 210 / maximum;
  return packColor({
    blue: Math.round(channels.blue * scale),
    green: Math.round(channels.green * scale),
    red: Math.round(channels.red * scale),
  });
}

function definitionRepresentative(star: VirtualStarPreset): number {
  return (
    star.colorStages[Math.floor(star.colorStages.length / 2)]?.color ??
    star.colorStages[0]?.color ??
    0xffffff
  );
}

/**
 * Maps each quantized image color to the closest star already in the library.
 * No star definitions are created; legacy `star-image-*` entries are ignored
 * as mapping targets so older works converge back to library stars.
 */
export function resolveImageStars(
  colors: number[],
  starDefinitions: Record<string, VirtualStarPreset>,
  options: ResolveImageStarsOptions = {},
): ImageStarResolution {
  const clusters = options.preserveColorAssignments
    ? exactColorClusters(colors)
    : quantizeColors(
        colors,
        Math.round(
          clamp(
            options.maximumColors ??
              DEFAULT_IMAGE_PLACEMENT_SETTINGS.maximumColors,
            1,
            4,
          ),
        ),
      );
  const libraryStars = Object.values(starDefinitions).filter(
    (star) => !/^star-image-\d+$/.test(star.id),
  );
  const mappingTargets =
    libraryStars.length > 0 ? libraryStars : Object.values(starDefinitions);
  const clusterStarIds = new Map<ColorCluster, string>();

  clusters.forEach((cluster) => {
    const nearest = mappingTargets
      .map((star) => ({
        distance: colorDistance(
          visibleFireworkColor(cluster.representative),
          definitionRepresentative(star),
        ),
        id: star.id,
      }))
      .sort(
        (left, right) =>
          left.distance - right.distance || left.id.localeCompare(right.id),
      )[0];
    if (nearest) clusterStarIds.set(cluster, nearest.id);
  });

  const starIds = Array.from({ length: colors.length }, () => "");
  clusters.forEach((cluster) => {
    const starId = clusterStarIds.get(cluster);
    if (!starId) return;
    cluster.entries.forEach((entry) => {
      starIds[entry.index] = starId;
    });
  });
  return {
    createdStarIds: [],
    starDefinitions: structuredClone(starDefinitions),
    starIds,
  };
}
