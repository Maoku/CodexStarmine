import { describe, expect, it } from "vitest";

import type { ImageDataLike } from "./ImagePlacementRecipe";
import { createFastPromptMask } from "./PromptMaskProvider";

function image(
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set(pixel(x, y), (y * width + x) * 4);
    }
  }
  return { data, height, width };
}

describe("PromptMaskProvider", () => {
  it("keeps the subject-seeded component and excludes another object", () => {
    const source = image(32, 20, (x, y) => {
      if (x >= 3 && x <= 12 && y >= 4 && y <= 15) return [210, 40, 35, 255];
      if (x >= 19 && x <= 28 && y >= 4 && y <= 15) return [35, 75, 210, 255];
      return [245, 245, 245, 255];
    });
    const result = createFastPromptMask(source, [
      { id: "subject", kind: "subject", point: { x: 0.25, y: 0.5 } },
    ]);

    expect(result.provider).toBe("fast");
    expect(result.mask.data[10 * 32 + 8]).toBe(255);
    expect(result.mask.data[10 * 32 + 24]).toBe(0);
    expect(result.mask.data[0]).toBe(0);
  });

  it("uses transparency and honors explicit background seeds", () => {
    const source = image(24, 24, (x, y) =>
      x >= 4 && x <= 19 && y >= 4 && y <= 19
        ? [220, 140, 70, 255]
        : [0, 0, 0, 0],
    );
    const result = createFastPromptMask(source, [
      { id: "subject", kind: "subject", point: { x: 0.3, y: 0.5 } },
      { id: "background", kind: "background", point: { x: 0.75, y: 0.5 } },
      { id: "feature", kind: "feature", point: { x: 0.5, y: 0.5 } },
    ]);

    expect(result.provider).toBe("alpha");
    expect(result.mask.data[12 * 24 + 7]).toBe(255);
    expect(result.mask.data[12 * 24 + 18]).toBe(0);
    expect(result.mask.data[0]).toBe(0);
  });
});
