import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "./presets";
import { resolveSizePreset, withSizeClass } from "./sizes";

describe("size presets", () => {
  it("increases height, diameter, density and apparent brightness together", () => {
    const small = resolveSizePreset("small");
    const medium = resolveSizePreset("medium");
    const large = resolveSizePreset("large");
    expect(small.targetHeight).toBeLessThan(medium.targetHeight);
    expect(medium.targetHeight).toBeLessThan(large.targetHeight);
    expect(small.burstScale).toBeLessThan(medium.burstScale);
    expect(medium.particleScale).toBeLessThan(large.particleScale);
    expect(medium.pointScale).toBeLessThan(large.pointScale);
  });

  it("creates a sized copy without mutating the preset", () => {
    const large = withSizeClass(CHRYSANTHEMUM_PRESET, "large");
    expect(large.sizeClass).toBe("large");
    expect(CHRYSANTHEMUM_PRESET.sizeClass).toBe("medium");
  });
});
