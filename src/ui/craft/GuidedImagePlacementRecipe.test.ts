import { describe, expect, it } from "vitest";

import {
  allocateGuidedPlacementBudgets,
  cleanSubjectMask,
  createGuidedImagePlacement,
  internalBoundaryWeights,
  quantizeSubjectMap,
  refineQuantizedSubjectMap,
  sampleInternalBoundary,
  traceInternalColorBoundaries,
  traceMaskContours,
} from "./GuidedImagePlacementRecipe";
import type {
  ImagePrompt,
  InternalColorBoundary,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import {
  IMAGE_PLACEMENT_MAXIMUM_POINTS,
  IMAGE_PLACEMENT_SAFETY_RADIUS,
  type ImageDataLike,
} from "./ImagePlacementRecipe";

function rectangleMask(
  width: number,
  height: number,
  minimumX: number,
  minimumY: number,
  maximumX: number,
  maximumY: number,
): SubjectMask {
  const data = new Uint8Array(width * height);
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      data[y * width + x] = 255;
    }
  }
  return { data, height, width };
}

function coloredImage(width: number, height: number): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data.set(
        x < width / 2 ? [210, 130, 70, 255] : [50, 90, 190, 255],
        offset,
      );
    }
  }
  return { data, height, width };
}

describe("GuidedImagePlacementRecipe", () => {
  it("traces deterministic outer and hole contours", () => {
    const mask = rectangleMask(24, 24, 3, 3, 20, 20);
    for (let y = 8; y <= 15; y += 1) {
      for (let x = 8; x <= 15; x += 1) mask.data[y * 24 + x] = 0;
    }
    const first = traceMaskContours(mask);
    const second = traceMaskContours(mask);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first.map((contour) => contour.hole)).toEqual([false, true]);
    first.forEach((contour) => expect(contour.length).toBeGreaterThan(0));
  });

  it("keeps subject components while dropping unprompted components", () => {
    const mask = rectangleMask(32, 20, 3, 3, 12, 16);
    for (let y = 3; y <= 16; y += 1) {
      for (let x = 20; x <= 28; x += 1) mask.data[y * 32 + x] = 255;
    }
    const prompts: ImagePrompt[] = [
      { id: "subject", kind: "subject", point: { x: 0.25, y: 0.5 } },
    ];
    const cleaned = cleanSubjectMask(mask, prompts);

    expect(cleaned.data[10 * 32 + 8]).toBe(255);
    expect(cleaned.data[10 * 32 + 24]).toBe(0);
  });

  it("spends one point per feature and the rest on the outline", () => {
    const image = coloredImage(64, 48);
    const mask = rectangleMask(64, 48, 8, 6, 55, 41);
    const prompts: ImagePrompt[] = [
      { id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } },
      { id: "left-eye", kind: "feature", point: { x: 0.35, y: 0.45 } },
      { id: "right-eye", kind: "feature", point: { x: 0.65, y: 0.45 } },
    ];
    const first = createGuidedImagePlacement(
      image,
      mask,
      prompts,
      { placementMode: "outline", targetCount: 64 },
      "fast",
      3,
    );
    const second = createGuidedImagePlacement(
      image,
      mask,
      prompts,
      { placementMode: "outline", targetCount: 64 },
      "fast",
      3,
    );

    expect(first).toEqual(second);
    expect(first.points).toHaveLength(64);
    expect(first.colors).toHaveLength(64);
    expect(first.diagnostics.outlinePointCount).toBe(62);
    expect(first.diagnostics.interiorPointCount).toBe(0);
    expect(first.diagnostics.featurePointCounts).toEqual({
      "left-eye": 1,
      "right-eye": 1,
    });
    first.points.forEach((point) =>
      expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(
        IMAGE_PLACEMENT_SAFETY_RADIUS,
      ),
    );
  });

  it("defaults to 1024 outline and internal-boundary points", () => {
    const result = createGuidedImagePlacement(
      coloredImage(64, 48),
      rectangleMask(64, 48, 8, 6, 55, 41),
      [{ id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } }],
    );

    expect(result.points).toHaveLength(1024);
    expect(result.diagnostics.outlinePointCount).toBe(461);
    expect(result.diagnostics.internalBoundaryPointCount).toBe(563);
    expect(result.diagnostics.interiorPointCount).toBe(0);
    expect(result.pointKinds).toHaveLength(result.points.length);
  });

  it("fills the subject interior deterministically up to 2048 points", () => {
    const image = coloredImage(80, 64);
    const mask = rectangleMask(80, 64, 4, 4, 75, 59);
    const prompts: ImagePrompt[] = [
      { id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } },
    ];
    const first = createGuidedImagePlacement(image, mask, prompts, {
      placementMode: "outline-internal-boundary-filled",
      targetCount: 4096,
    });
    const second = createGuidedImagePlacement(image, mask, prompts, {
      placementMode: "outline-internal-boundary-filled",
      targetCount: 4096,
    });

    expect(first).toEqual(second);
    expect(first.points).toHaveLength(IMAGE_PLACEMENT_MAXIMUM_POINTS);
    expect(first.diagnostics.outlinePointCount).toBe(615);
    expect(first.diagnostics.internalBoundaryPointCount).toBe(819);
    expect(first.diagnostics.interiorPointCount).toBe(614);
    const interiorPoints = first.points.slice(
      first.diagnostics.outlinePointCount,
      first.diagnostics.outlinePointCount +
        first.diagnostics.interiorPointCount,
    );
    expect(
      interiorPoints.some((point) => Math.hypot(point.x, point.y) < 0.1),
    ).toBe(true);
  });

  it("falls back to one representative image color without an outline star", () => {
    const width = 72;
    const height = 48;
    const data = new Uint8ClampedArray(width * height * 4);
    const sourceColors = [0xe0443e, 0x4a76df, 0x44b96a, 0xf1b63c];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const color = sourceColors[Math.min(3, Math.floor(x / 18))];
        const offset = (y * width + x) * 4;
        data.set(
          [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 255],
          offset,
        );
      }
    }
    const result = createGuidedImagePlacement(
      { data, height, width },
      rectangleMask(width, height, 4, 4, 67, 43),
      [{ id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } }],
      { targetCount: 72 },
    );
    const outlineColors = result.colors.slice(
      0,
      result.diagnostics.outlinePointCount,
    );

    expect(new Set(outlineColors).size).toBe(1);
    expect(result.preserveColorAssignments).toBe(true);
  });

  it("limits image-derived interior colors to eight representatives", () => {
    const width = 100;
    const height = 64;
    const sourceColors = [
      0xe53935, 0xfb8c00, 0xfdd835, 0x7cb342, 0x00897b, 0x039be5, 0x3949ab,
      0x8e24aa, 0xd81b60, 0x795548,
    ];
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const color = sourceColors[Math.floor(x / 10)];
        const offset = (y * width + x) * 4;
        data.set(
          [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff, 255],
          offset,
        );
      }
    }
    const result = createGuidedImagePlacement(
      { data, height, width },
      rectangleMask(width, height, 2, 2, width - 3, height - 3),
      [{ id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } }],
      {
        placementMode: "outline-internal-boundary-filled",
        imageStarKind: "trail",
        outlineStar: { color: 0xbfe4ff, starId: "star-silver" },
        targetCount: 512,
      },
    );
    const interiorStart = result.diagnostics.outlinePointCount;
    const interiorEnd = interiorStart + result.diagnostics.interiorPointCount;
    const imagePalette = new Set(
      result.colors.slice(interiorStart, interiorEnd),
    );

    expect(imagePalette.size).toBeGreaterThan(1);
    expect(imagePalette.size).toBeLessThanOrEqual(8);
    expect(result.imageStarKind).toBe("trail");
    expect(
      result.colors
        .slice(0, interiorStart)
        .every((color) => color === 0xbfe4ff),
    ).toBe(true);
  });

  it("assigns one separately selected existing star across the outline", () => {
    const result = createGuidedImagePlacement(
      coloredImage(64, 48),
      rectangleMask(64, 48, 8, 6, 55, 41),
      [{ id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } }],
      {
        outlineStar: { color: 0xbfe4ff, starId: "star-silver" },
        placementMode: "outline",
        targetCount: 64,
      },
    );

    expect(new Set(result.starIds)).toEqual(new Set(["star-silver"]));
    expect(new Set(result.colors)).toEqual(new Set([0xbfe4ff]));
  });

  it("places the feature star exactly at the specified point", () => {
    const image = coloredImage(64, 48);
    const mask = rectangleMask(64, 48, 8, 6, 55, 41);
    const result = createGuidedImagePlacement(image, mask, [
      { id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } },
      { id: "center", kind: "feature", point: { x: 0.5, y: 0.5 } },
    ]);

    // The mask bounding box is centered on (0.5, 0.5), so the feature prompt
    // there must land on the section origin.
    expect(result.diagnostics.featurePointCounts).toEqual({ center: 1 });
    const featurePoint = result.points.at(-1);
    expect(featurePoint?.x).toBeCloseTo(0, 9);
    expect(featurePoint?.y).toBeCloseTo(0, 9);
  });

  it("warns and spends no budget for a feature outside the mask", () => {
    const image = coloredImage(40, 40);
    const result = createGuidedImagePlacement(
      image,
      rectangleMask(40, 40, 8, 8, 31, 31),
      [
        { id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } },
        { id: "outside", kind: "feature", point: { x: 0.02, y: 0.02 } },
      ],
      { placementMode: "outline", targetCount: 32 },
    );

    expect(result.points).toHaveLength(32);
    expect(result.diagnostics.featurePointCounts.outside).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.diagnostics.outlinePointCount).toBe(32);
  });

  it("labels a two-color subject and traces one deterministic internal boundary", () => {
    const image = coloredImage(64, 48);
    const mask = rectangleMask(64, 48, 4, 4, 59, 43);
    const firstMap = refineQuantizedSubjectMap(
      quantizeSubjectMap(image, mask),
      mask,
    );
    const secondMap = refineQuantizedSubjectMap(
      quantizeSubjectMap(image, mask),
      mask,
    );
    const first = traceInternalColorBoundaries(firstMap, mask);
    const second = traceInternalColorBoundaries(secondMap, mask);

    expect(firstMap.palette).toHaveLength(2);
    expect(firstMap.labels).toEqual(secondMap.labels);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0].points.every((point) => point.x === 32)).toBe(true);
    expect(first[0].length).toBeGreaterThan(30);
  });

  it("produces one palette color and no internal boundary for a flat subject", () => {
    const image = coloredImage(48, 40);
    const data = image.data as Uint8ClampedArray;
    for (let index = 0; index < 48 * 40; index += 1) {
      data.set([90, 140, 210, 255], index * 4);
    }
    const mask = rectangleMask(48, 40, 4, 4, 43, 35);
    const map = refineQuantizedSubjectMap(
      quantizeSubjectMap(image, mask),
      mask,
    );

    expect(map.palette).toHaveLength(1);
    expect(traceInternalColorBoundaries(map, mask)).toEqual([]);
  });

  it("removes isolated color noise before tracing boundaries", () => {
    const image = coloredImage(64, 48);
    const mask = rectangleMask(64, 48, 4, 4, 59, 43);
    const noisyOffset = (24 * 64 + 16) * 4;
    const mutableData = image.data as Uint8ClampedArray;
    mutableData.set([0, 255, 0, 255], noisyOffset);
    const map = refineQuantizedSubjectMap(
      quantizeSubjectMap(image, mask),
      mask,
    );
    const boundaries = traceInternalColorBoundaries(map, mask);

    expect(map.palette.length).toBeLessThanOrEqual(3);
    expect(boundaries).toHaveLength(1);
  });

  /*
   * Three vertical stripes: the left pair differs faintly, the right pair
   * strongly, and both internal boundaries have identical length.
   */
  function stripedImage(width: number, height: number): ImageDataLike {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const stripe =
          x < width / 3
            ? [200, 60, 60]
            : x < (2 * width) / 3
              ? [232, 92, 92]
              : [40, 80, 200];
        data.set([...stripe, 255], (y * width + x) * 4);
      }
    }
    return { data, height, width };
  }

  it("measures higher strength on the higher-contrast internal boundary", () => {
    const image = stripedImage(96, 48);
    const mask = rectangleMask(96, 48, 4, 4, 91, 43);
    const map = refineQuantizedSubjectMap(
      quantizeSubjectMap(image, mask),
      mask,
    );
    const boundaries = traceInternalColorBoundaries(map, mask, [], image);

    /* Median cut may keep an unused mixed box, so 3 is a lower bound. */
    expect(map.palette.length).toBeGreaterThanOrEqual(3);
    expect(boundaries).toHaveLength(2);
    const weak = boundaries.find((boundary) =>
      boundary.points.every((point) => point.x === 32),
    );
    const strong = boundaries.find((boundary) =>
      boundary.points.every((point) => point.x === 64),
    );
    expect(weak).toBeDefined();
    expect(strong).toBeDefined();
    expect(strong!.strength).toBeGreaterThan(weak!.strength * 2);
    expect(Math.abs(strong!.length - weak!.length)).toBeLessThanOrEqual(1);
  });

  it("weights equal-length boundaries by strength with a floor for weak ones", () => {
    const image = stripedImage(96, 48);
    const mask = rectangleMask(96, 48, 4, 4, 91, 43);
    const map = refineQuantizedSubjectMap(
      quantizeSubjectMap(image, mask),
      mask,
    );
    const boundaries = traceInternalColorBoundaries(map, mask, [], image);
    const weights = internalBoundaryWeights(boundaries);
    const strongIndex = boundaries.findIndex((boundary) =>
      boundary.points.every((point) => point.x === 64),
    );
    const weakIndex = 1 - strongIndex;

    expect(weights[strongIndex]).toBeGreaterThan(weights[weakIndex] * 1.5);
    /* The floor keeps the weak boundary from disappearing entirely. */
    expect(weights[weakIndex]).toBeGreaterThan(
      boundaries[weakIndex].length * 0.3,
    );
  });

  it("spends more boundary points on the stronger of two equal-length boundaries", () => {
    const image = stripedImage(96, 48);
    const mask = rectangleMask(96, 48, 4, 4, 91, 43);
    const result = createGuidedImagePlacement(
      image,
      mask,
      [{ id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } }],
      { targetCount: 256 },
    );
    const boundaryColors = result.colors.filter(
      (_, index) => result.pointKinds[index] === "internal-boundary",
    );
    /* Colors unique to one boundary count roughly half its points. */
    const weakOnly = boundaryColors.filter(
      (color) => color === 0xc83c3c,
    ).length;
    const strongOnly = boundaryColors.filter(
      (color) => color === 0x2850c8,
    ).length;

    expect(weakOnly).toBeGreaterThan(0);
    expect(strongOnly).toBeGreaterThan(weakOnly * 1.5);
  });

  it("snaps sampled internal-boundary points onto the image gradient peak", () => {
    // The real color step sits at x = 40; the boundary polyline is 2px off.
    const width = 64;
    const height = 48;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        data.set(
          x < 40 ? [30, 30, 30, 255] : [230, 230, 230, 255],
          (y * width + x) * 4,
        );
      }
    }
    const image: ImageDataLike = { data, height, width };
    const mask = rectangleMask(width, height, 2, 2, 61, 45);
    const boundary: InternalColorBoundary = {
      colorA: 0x1e1e1e,
      colorB: 0xe6e6e6,
      length: 36,
      points: [
        { x: 38, y: 6 },
        { x: 38, y: 42 },
      ],
      strength: 1,
    };

    const samples = sampleInternalBoundary(boundary, 12, image, mask);
    const unsnapped = sampleInternalBoundary(boundary, 12);

    expect(samples).toHaveLength(12);
    samples.forEach((point) => expect(point.x).toBeGreaterThan(38.5));
    unsnapped.forEach((point) => expect(point.x).toBe(38));
  });

  it("concentrates samples on the high-contrast section of one boundary", () => {
    // One vertical boundary at x = 32: crisp against the top-right region,
    // faint against the bottom-right one.
    const width = 64;
    const height = 48;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const color =
          x < 32 ? [20, 20, 20] : y < 24 ? [240, 240, 240] : [45, 45, 45];
        data.set([...color, 255], (y * width + x) * 4);
      }
    }
    const image: ImageDataLike = { data, height, width };
    const mask = rectangleMask(width, height, 2, 2, 61, 45);
    const boundary: InternalColorBoundary = {
      colorA: 0x141414,
      colorB: 0xf0f0f0,
      length: 36,
      points: [
        { x: 32, y: 6 },
        { x: 32, y: 42 },
      ],
      strength: 1,
    };

    const samples = sampleInternalBoundary(boundary, 24, image, mask);
    const topCount = samples.filter((point) => point.y < 24).length;
    const bottomCount = samples.length - topCount;

    expect(samples).toHaveLength(24);
    expect(bottomCount).toBeGreaterThan(0);
    expect(topCount).toBeGreaterThan(bottomCount * 1.5);
  });

  it("smooths closed internal boundaries while keeping the loop closed", () => {
    const width = 48;
    const height = 48;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const island = x >= 18 && x <= 29 && y >= 18 && y <= 29;
        data.set(
          island ? [40, 80, 200, 255] : [200, 60, 60, 255],
          (y * width + x) * 4,
        );
      }
    }
    const image: ImageDataLike = { data, height, width };
    const mask = rectangleMask(width, height, 4, 4, 43, 43);
    const map = refineQuantizedSubjectMap(
      quantizeSubjectMap(image, mask),
      mask,
    );
    const boundaries = traceInternalColorBoundaries(map, mask, [], image);
    const closed = boundaries.find(
      (candidate) =>
        candidate.points[0].x === candidate.points.at(-1)?.x &&
        candidate.points[0].y === candidate.points.at(-1)?.y,
    );

    expect(closed).toBeDefined();
    /* The moving average turns the pixel staircase into fractional corners. */
    expect(
      closed!.points.some(
        (point) => !Number.isInteger(point.x) || !Number.isInteger(point.y),
      ),
    ).toBe(true);
    expect(traceInternalColorBoundaries(map, mask, [], image)).toEqual(
      boundaries,
    );
  });

  it("allocates category budgets according to all three placement modes", () => {
    expect(allocateGuidedPlacementBudgets("outline", 100, true)).toEqual({
      interior: 0,
      internalBoundary: 0,
      outline: 100,
    });
    expect(
      allocateGuidedPlacementBudgets("outline-internal-boundary", 100, true),
    ).toEqual({ interior: 0, internalBoundary: 55, outline: 45 });
    expect(
      allocateGuidedPlacementBudgets(
        "outline-internal-boundary-filled",
        100,
        false,
      ),
    ).toEqual({ interior: 58, internalBoundary: 0, outline: 42 });
  });

  it("does not change geometry when dark-color enhancement is toggled", () => {
    const image = coloredImage(64, 48);
    const mask = rectangleMask(64, 48, 4, 4, 59, 43);
    const prompts: ImagePrompt[] = [
      { id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } },
    ];
    const enhanced = createGuidedImagePlacement(image, mask, prompts, {
      enhanceDarkColors: true,
      targetCount: 256,
    });
    const original = createGuidedImagePlacement(image, mask, prompts, {
      enhanceDarkColors: false,
      targetCount: 256,
    });

    expect(enhanced.points).toEqual(original.points);
    expect(enhanced.pointKinds).toEqual(original.pointKinds);
    expect(enhanced.diagnostics.internalBoundaryCount).toBe(
      original.diagnostics.internalBoundaryCount,
    );
  });
});
