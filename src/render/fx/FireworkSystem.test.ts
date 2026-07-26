import { describe, expect, it } from "vitest";

import { PEONY_PRESET } from "../../data";
import { deriveEffectLOD, deriveLaunchKinematics } from "./FireworkSystem";

describe("deriveLaunchKinematics", () => {
  it("keeps check launches deterministic when the seed is fixed", () => {
    const first = deriveLaunchKinematics(PEONY_PRESET, {
      lane: 0,
      seed: 50_226,
    });
    const second = deriveLaunchKinematics(PEONY_PRESET, {
      lane: 0,
      seed: 50_226,
    });

    expect(second).toEqual(first);
  });

  it("uses the supplied target height without adding launch variation", () => {
    const launch = deriveLaunchKinematics(PEONY_PRESET, {
      seed: 50_226,
      targetHeight: 128,
    });

    expect(launch.targetHeight).toBe(128);
  });

  it("reduces only secondary detail, smoke, and trail sampling for low LOD", () => {
    const high = deriveEffectLOD({
      cameraPosition: { x: 0, y: 95, z: -112 },
      hardwareConcurrency: 12,
      pixelRatio: 1,
      viewportHeight: 900,
    });
    const low = deriveEffectLOD({
      cameraPosition: { x: 320, y: 95, z: 180 },
      hardwareConcurrency: 4,
      pixelRatio: 2,
      viewportHeight: 1_200,
    });
    expect(high).toEqual({
      secondaryScale: 1,
      smokeScale: 0.82,
      trailSampleStride: 1,
    });
    expect(low.secondaryScale).toBeLessThan(high.secondaryScale);
    expect(low.smokeScale).toBeLessThan(high.smokeScale);
    expect(low.trailSampleStride).toBeGreaterThan(high.trailSampleStride);
  });
});
