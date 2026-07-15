import { describe, expect, it } from "vitest";

import {
  createHeartPoints,
  FIREWORK_PRESETS,
  HEART_PRESET,
  SENRIN_PRESET,
} from "../../data";
import { compileFireworkDesign, fibonacciSphere } from "./compiler";

describe("Phase 6.5 burst compiler", () => {
  it("generates the requested number of unit points without polar concentration", () => {
    const points = fibonacciSphere(600);
    expect(points).toHaveLength(600);
    points.forEach((point) => {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1, 8);
    });
    const bands = Array.from(
      { length: 10 },
      (_, band) =>
        points.filter((point) => {
          const start = -1 + band * 0.2;
          return point.y >= start && point.y < start + 0.2;
        }).length,
    );
    expect(Math.max(...bands) - Math.min(...bands)).toBeLessThanOrEqual(1);
  });

  it("compiles all six migrated presets deterministically", () => {
    FIREWORK_PRESETS.forEach((preset) => {
      const first = compileFireworkDesign(preset, 42_4242);
      const second = compileFireworkDesign(preset, 42_4242);
      expect(second).toEqual(first);
      expect(first.stars.length + first.childBursts.length).toBeGreaterThan(0);
      expect(first.bounds.radius).toBeGreaterThan(0);
    });
  });

  it("keeps the two-color heart groups and audience-facing policy", () => {
    const pattern = HEART_PRESET.layers.find(
      (layer) => layer.kind === "pattern",
    );
    expect(pattern?.groups).toHaveLength(2);
    expect(pattern?.facingPolicy).toBe("audience");
    const plan = compileFireworkDesign(HEART_PRESET, 7);
    expect(
      new Set(
        plan.stars.map(
          (star) =>
            star.definition.colorStages[1]?.color ??
            star.definition.colorStages[0]?.color,
        ),
      ).size,
    ).toBeGreaterThanOrEqual(1);
  });

  it("resamples the heart outline at nearly equal intervals", () => {
    const points = createHeartPoints(96);
    const distances = points.map((point, index) => {
      const next = points[(index + 1) % points.length];
      return Math.hypot(next.x - point.x, next.y - point.y);
    });
    const average =
      distances.reduce((sum, value) => sum + value, 0) / distances.length;
    expect(Math.max(...distances) / average).toBeLessThan(1.08);
    expect(Math.min(...distances) / average).toBeGreaterThan(0.92);
  });

  it("compiles delayed child bursts for senrin", () => {
    const plan = compileFireworkDesign(SENRIN_PRESET, 99);
    expect(plan.childBursts).toHaveLength(12);
    expect(plan.childBursts[1].delay).toBeGreaterThan(
      plan.childBursts[0].delay,
    );
    expect(plan.estimatedCost.maximumParticles).toBeGreaterThan(
      plan.estimatedCost.starCount,
    );
  });
});
