import { describe, expect, it } from "vitest";

import {
  cleanSubjectMask,
  createGuidedImagePlacement,
  traceMaskContours,
} from "./GuidedImagePlacementRecipe";
import type { ImagePrompt, SubjectMask } from "./GuidedImagePlacementTypes";
import {
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
      { targetCount: 64 },
      "fast",
      3,
    );
    const second = createGuidedImagePlacement(
      image,
      mask,
      prompts,
      { targetCount: 64 },
      "fast",
      3,
    );

    expect(first).toEqual(second);
    expect(first.points).toHaveLength(64);
    expect(first.colors).toHaveLength(64);
    expect(first.diagnostics.outlinePointCount).toBe(62);
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
      { targetCount: 32 },
    );

    expect(result.points).toHaveLength(32);
    expect(result.diagnostics.featurePointCounts.outside).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.diagnostics.outlinePointCount).toBe(32);
  });
});
