import type {
  GuidedMaskProvider,
  ImagePrompt,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import type { ImageDataLike } from "./ImagePlacementRecipe";

export interface PromptMaskResult {
  mask: SubjectMask;
  provider: GuidedMaskProvider;
}

export interface PromptMaskProvider {
  readonly kind: GuidedMaskProvider;
  segment(image: ImageDataLike, prompts: ImagePrompt[]): PromptMaskResult;
}

interface RGB {
  blue: number;
  green: number;
  red: number;
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

function distance(left: RGB, right: RGB): number {
  return Math.hypot(
    left.red - right.red,
    left.green - right.green,
    left.blue - right.blue,
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

function nearestDistance(color: RGB, references: RGB[]): number {
  return references.reduce(
    (best, reference) => Math.min(best, distance(color, reference)),
    Number.POSITIVE_INFINITY,
  );
}

function hasUsefulAlpha(image: ImageDataLike): boolean {
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

function connectedComponentsContainingSeeds(
  source: Uint8Array,
  width: number,
  seeds: number[],
): Uint8Array {
  const result = new Uint8Array(source.length);
  const visited = new Uint8Array(source.length);
  const seedSet = new Set(seeds);
  for (const start of seeds) {
    if (!source[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let containsSeed = false;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      containsSeed ||= seedSet.has(index);
      const x = index % width;
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index - width,
        index + width,
      ];
      for (const neighbor of neighbors) {
        if (
          neighbor >= 0 &&
          neighbor < source.length &&
          source[neighbor] &&
          !visited[neighbor]
        ) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    if (containsSeed) queue.forEach((index) => (result[index] = 255));
  }
  return result;
}

function automaticForeground(image: ImageDataLike): Uint8Array {
  const size = image.width * image.height;
  const usefulAlpha = hasUsefulAlpha(image);
  const background = borderIndices(image.width, image.height).map((index) =>
    colorAt(image, index),
  );
  const mask = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    const opacity = image.data[index * 4 + 3] ?? 0;
    const different = nearestDistance(colorAt(image, index), background) > 28;
    if (opacity > 32 && (usefulAlpha || different)) mask[index] = 255;
  }
  return mask;
}

export function createFastPromptMask(
  image: ImageDataLike,
  prompts: ImagePrompt[],
): PromptMaskResult {
  const size = image.width * image.height;
  const subjectPrompts = prompts.filter((prompt) => prompt.kind === "subject");
  const backgroundPrompts = prompts.filter(
    (prompt) => prompt.kind === "background",
  );
  const alpha = hasUsefulAlpha(image);
  if (subjectPrompts.length === 0) {
    return {
      mask: {
        data: automaticForeground(image),
        height: image.height,
        width: image.width,
      },
      provider: alpha ? "alpha" : "fast",
    };
  }

  const subjectSeeds = subjectPrompts.map((prompt) =>
    pixelIndex(prompt.point, image.width, image.height),
  );
  const backgroundSeeds = backgroundPrompts.map((prompt) =>
    pixelIndex(prompt.point, image.width, image.height),
  );
  const subjectColors = subjectSeeds.map((index) => colorAt(image, index));
  const backgroundColors = [
    ...backgroundSeeds.map((index) => colorAt(image, index)),
    ...borderIndices(image.width, image.height).map((index) =>
      colorAt(image, index),
    ),
  ];
  const classified = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    const opacity = image.data[index * 4 + 3] ?? 0;
    if (opacity <= 24) continue;
    if (alpha) {
      classified[index] = 255;
      continue;
    }
    const color = colorAt(image, index);
    const subjectDistance = nearestDistance(color, subjectColors);
    const backgroundDistance = nearestDistance(color, backgroundColors);
    if (
      subjectDistance <= 118 &&
      subjectDistance + 7 <= backgroundDistance * 1.08
    ) {
      classified[index] = 255;
    }
  }
  subjectSeeds.forEach((index) => (classified[index] = 255));
  backgroundSeeds.forEach((index) => (classified[index] = 0));
  if (alpha && backgroundSeeds.length > 0) {
    const exclusionRadius = Math.max(
      2,
      Math.round(Math.min(image.width, image.height) * 0.08),
    );
    backgroundSeeds.forEach((seed) => {
      const seedX = seed % image.width;
      const seedY = Math.floor(seed / image.width);
      const seedColor = colorAt(image, seed);
      for (
        let y = Math.max(0, seedY - exclusionRadius);
        y <= Math.min(image.height - 1, seedY + exclusionRadius);
        y += 1
      ) {
        for (
          let x = Math.max(0, seedX - exclusionRadius);
          x <= Math.min(image.width - 1, seedX + exclusionRadius);
          x += 1
        ) {
          if (Math.hypot(x - seedX, y - seedY) > exclusionRadius) continue;
          const index = y * image.width + x;
          if (distance(colorAt(image, index), seedColor) <= 48) {
            classified[index] = 0;
          }
        }
      }
    });
    subjectSeeds.forEach((index) => (classified[index] = 255));
  }

  const kept = connectedComponentsContainingSeeds(
    classified,
    image.width,
    subjectSeeds,
  );
  subjectSeeds.forEach((index) => (kept[index] = 255));
  backgroundSeeds.forEach((index) => (kept[index] = 0));
  return {
    mask: { data: kept, height: image.height, width: image.width },
    provider: alpha ? "alpha" : "fast",
  };
}

export const FAST_PROMPT_MASK_PROVIDER: PromptMaskProvider = {
  kind: "fast",
  segment: createFastPromptMask,
};
