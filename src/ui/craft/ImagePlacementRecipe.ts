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
}

export interface ImageStarResolution {
  createdStarIds: string[];
  starDefinitions: Record<string, VirtualStarPreset>;
  starIds: string[];
}

export const DEFAULT_IMAGE_PLACEMENT_SETTINGS: ImagePlacementSettings = {
  maximumColors: 4,
  targetCount: 96,
};

export const IMAGE_PLACEMENT_MAXIMUM_POINTS = 240;
export const IMAGE_PLACEMENT_MINIMUM_POINTS = 8;
export const IMAGE_PLACEMENT_SAFETY_RADIUS = 0.94;

const BACKGROUND_DIFFERENCE_THRESHOLD = 24;
const EXISTING_STAR_COLOR_THRESHOLD = 72;

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

function pixelCandidates(image: ImageDataLike): PixelCandidate[] {
  const background = backgroundColor(image);
  const scale =
    (IMAGE_PLACEMENT_SAFETY_RADIUS * 2) / Math.hypot(image.width, image.height);
  const centerX = image.width / 2;
  const centerY = image.height / 2;
  const candidates: PixelCandidate[] = [];
  let maximumImportance = 0;

  for (let index = 0; index < image.width * image.height; index += 1) {
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
    const importance =
      background.alpha < 16
        ? alpha
        : rgbDifference * (alpha / 255) + alphaDifference;
    maximumImportance = Math.max(maximumImportance, importance);
    candidates.push({
      blue,
      color: packColor({ blue, green, red }),
      green,
      importance,
      index,
      point: {
        x: ((index % image.width) + 0.5 - centerX) * scale,
        y: (centerY - (Math.floor(index / image.width) + 0.5)) * scale,
      },
      red,
    });
  }

  const threshold = Math.max(
    BACKGROUND_DIFFERENCE_THRESHOLD,
    maximumImportance * 0.08,
  );
  return candidates
    .filter((candidate) => candidate.importance >= threshold)
    .sort(
      (left, right) =>
        right.importance - left.importance || left.index - right.index,
    );
}

function sampleCandidates(
  candidates: PixelCandidate[],
  targetCount: number,
): PixelCandidate[] {
  if (candidates.length <= targetCount) return candidates;
  const initialDistance =
    Math.sqrt((Math.PI * IMAGE_PLACEMENT_SAFETY_RADIUS ** 2) / targetCount) *
    0.82;
  let selected: PixelCandidate[] = [];

  for (const distanceScale of [1, 0.84, 0.7, 0.56, 0.42, 0]) {
    const minimumDistance = initialDistance * distanceScale;
    if (minimumDistance === 0) {
      return Array.from(
        { length: targetCount },
        (_, index) =>
          candidates[Math.floor((index * candidates.length) / targetCount)],
      );
    }
    selected = [];
    for (const candidate of candidates) {
      if (
        selected.every(
          (item) =>
            Math.hypot(
              item.point.x - candidate.point.x,
              item.point.y - candidate.point.y,
            ) >= minimumDistance,
        )
      ) {
        selected.push(candidate);
      }
    }
    if (selected.length >= targetCount) {
      return Array.from(
        { length: targetCount },
        (_, index) =>
          selected[Math.floor((index * selected.length) / targetCount)],
      );
    }
  }
  return selected.slice(0, targetCount);
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
  const selected = sampleCandidates(pixelCandidates(image), targetCount);
  return {
    colors: selected.map((candidate) => candidate.color),
    points: selected.map((candidate) => candidate.point),
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

function definitionRepresentative(star: VirtualStarPreset): number {
  return (
    star.colorStages[Math.floor(star.colorStages.length / 2)]?.color ??
    star.colorStages[0]?.color ??
    0xffffff
  );
}

function dimColor(color: number): number {
  const value = rgb(color);
  return packColor({
    blue: Math.round(value.blue * 0.38),
    green: Math.round(value.green * 0.38),
    red: Math.round(value.red * 0.38),
  });
}

function createImageStar(id: string, color: number): VirtualStarPreset {
  const dimmed = dimColor(color);
  return {
    brightness: 1,
    burnDuration: 2.5,
    colorStages: [
      {
        color: 0xffffff,
        intensity: 1.35,
        normalizedTime: 0,
        trailColor: color,
      },
      {
        color,
        intensity: 1.08,
        normalizedTime: 0.14,
        trailColor: color,
      },
      {
        color: dimmed,
        intensity: 0.72,
        normalizedTime: 0.68,
        trailColor: dimmed,
      },
      {
        color: dimmed,
        intensity: 0,
        normalizedTime: 1,
        trailColor: dimmed,
      },
    ],
    displayName: `画像由来 ${id.replace("star-image-", "")}`,
    drag: 0.55,
    emissionKind: "point",
    flicker: 0.08,
    gravityScale: 0.8,
    id,
    smokeAmount: 0.35,
    soundTag: "soft",
    trailLifetime: 0.08,
    trailWidth: 0.9,
  };
}

function nextImageStarId(
  definitions: Record<string, VirtualStarPreset>,
): string {
  let index = 1;
  while (definitions[`star-image-${index}`]) index += 1;
  return `star-image-${index}`;
}

export function resolveImageStars(
  colors: number[],
  starDefinitions: Record<string, VirtualStarPreset>,
  maximumColors = DEFAULT_IMAGE_PLACEMENT_SETTINGS.maximumColors,
): ImageStarResolution {
  const definitions = structuredClone(starDefinitions);
  const clusters = quantizeColors(
    colors,
    Math.round(clamp(maximumColors, 1, 4)),
  );
  const createdStarIds: string[] = [];
  const clusterStarIds = new Map<ColorCluster, string>();

  clusters.forEach((cluster) => {
    const nearest = Object.values(definitions)
      .map((star) => ({
        distance: colorDistance(
          cluster.representative,
          definitionRepresentative(star),
        ),
        id: star.id,
      }))
      .sort(
        (left, right) =>
          left.distance - right.distance || left.id.localeCompare(right.id),
      )[0];
    if (nearest && nearest.distance <= EXISTING_STAR_COLOR_THRESHOLD) {
      clusterStarIds.set(cluster, nearest.id);
      return;
    }
    const id = nextImageStarId(definitions);
    definitions[id] = createImageStar(id, cluster.representative);
    createdStarIds.push(id);
    clusterStarIds.set(cluster, id);
  });

  const starIds = Array.from({ length: colors.length }, () => "");
  clusters.forEach((cluster) => {
    const starId = clusterStarIds.get(cluster);
    if (!starId) return;
    cluster.entries.forEach((entry) => {
      starIds[entry.index] = starId;
    });
  });
  return { createdStarIds, starDefinitions: definitions, starIds };
}
