import { describe, expect, it } from "vitest";

import { clampPixelRatio, MAX_RENDER_PIXEL_RATIO } from "./pixelRatio";

describe("clampPixelRatio", () => {
  it("keeps standard density unchanged", () => {
    expect(clampPixelRatio(1)).toBe(1);
    expect(clampPixelRatio(1.5)).toBe(1.5);
  });

  it("limits high-density displays to the rendering budget", () => {
    expect(clampPixelRatio(3)).toBe(MAX_RENDER_PIXEL_RATIO);
  });

  it("falls back safely for invalid values", () => {
    expect(clampPixelRatio(Number.NaN)).toBe(1);
    expect(clampPixelRatio(0)).toBe(1);
  });
});
