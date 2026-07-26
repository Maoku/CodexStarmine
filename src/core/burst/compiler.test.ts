import { describe, expect, it } from "vitest";

import {
  createHeartPoints,
  CHRYSANTHEMUM_PRESET,
  ensureFireworkDesignV4,
  FIREWORK_PRESETS,
  HEART_PRESET,
  SENRIN_PRESET,
  type FireworkDesignV4,
  type PatternLayerIntent,
} from "../../data";
import {
  compileFireworkDesign,
  fibonacciSphere,
  isValidAuthoredPoint,
} from "./compiler";

function patternDesign(
  template: PatternLayerIntent["pattern"]["template"],
  section: PatternLayerIntent["pattern"]["section"] = {
    plane: "xy",
    ratio: 0.5,
  },
  scale = 0.72,
): FireworkDesignV4 {
  const design = ensureFireworkDesignV4(HEART_PRESET);
  const source = design.layers[0]!;
  design.layers = [
    {
      authoringMode: "pattern",
      defaultStarId: source.defaultStarId,
      id: "authored-pattern",
      ignitionOffset: 0,
      locked: false,
      name: "型物",
      pattern: {
        density: 96,
        rotationDegrees: 0,
        scale,
        section,
        template,
      },
      radialSpeedScale: 1,
      visible: true,
    },
  ];
  return design;
}

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

  it("compiles every built-in preset deterministically", () => {
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

  it("preserves authored heart magnitude and notch in compiled velocity", () => {
    const circle = compileFireworkDesign(patternDesign("circle"), 81_503);
    const heart = compileFireworkDesign(patternDesign("heart"), 81_503);
    expect(heart).not.toEqual(circle);

    const projected = heart.stars.map((star) => star.initialVelocity);
    const width = Math.max(...projected.map((point) => Math.abs(point.x)));
    const nearCenter = projected.filter(
      (point) => Math.abs(point.x) < width * 0.08,
    );
    const upperCenter = Math.max(...nearCenter.map((point) => point.y));
    const upperLobes = Math.max(...projected.map((point) => point.y));
    const bottom = projected.reduce((lowest, point) =>
      point.y < lowest.y ? point : lowest,
    );

    expect(upperCenter).toBeLessThan(upperLobes * 0.72);
    expect(Math.abs(bottom.x)).toBeLessThan(width * 0.08);
    expect(bottom.y).toBeLessThan(-upperLobes);
  });

  it("keeps authored scale and section displacement in velocity space", () => {
    const small = compileFireworkDesign(
      patternDesign("circle", { plane: "xy", ratio: 0.5 }, 0.3),
      50_411,
    );
    const large = compileFireworkDesign(
      patternDesign("circle", { plane: "xy", ratio: 0.5 }, 0.8),
      50_411,
    );
    const shiftedXY = compileFireworkDesign(
      patternDesign("circle", { plane: "xy", ratio: 0.7 }),
      50_411,
    );
    const shiftedXZ = compileFireworkDesign(
      patternDesign("circle", { plane: "xz", ratio: 0.7 }),
      50_411,
    );
    const shiftedYZ = compileFireworkDesign(
      patternDesign("circle", { plane: "yz", ratio: 0.7 }),
      50_411,
    );
    const averageRadius = (design: typeof small) =>
      design.stars.reduce(
        (sum, star) =>
          sum + Math.hypot(star.initialVelocity.x, star.initialVelocity.y),
        0,
      ) / design.stars.length;
    const centroid = (design: typeof small) =>
      design.stars.reduce(
        (sum, star) => ({
          x: sum.x + star.initialVelocity.x / design.stars.length,
          y: sum.y + star.initialVelocity.y / design.stars.length,
          z: sum.z + star.initialVelocity.z / design.stars.length,
        }),
        { x: 0, y: 0, z: 0 },
      );

    expect(averageRadius(large)).toBeGreaterThan(averageRadius(small) * 2.4);
    expect(Math.abs(centroid(shiftedXY).z)).toBeGreaterThan(10);
    expect(Math.abs(centroid(shiftedXZ).y)).toBeGreaterThan(10);
    expect(Math.abs(centroid(shiftedYZ).x)).toBeGreaterThan(10);
  });

  it("rejects zero, non-finite, and out-of-shell authored points", () => {
    expect(isValidAuthoredPoint({ x: 0.2, y: 0.3, z: 0.4 })).toBe(true);
    expect(isValidAuthoredPoint({ x: 0, y: 0, z: 0 })).toBe(false);
    expect(isValidAuthoredPoint({ x: Number.NaN, y: 0, z: 0 })).toBe(false);
    expect(isValidAuthoredPoint({ x: 1.01, y: 0, z: 0 })).toBe(false);
  });

  it("adds effect metadata only to stars that opt into the new effect path", () => {
    const legacy = ensureFireworkDesignV4(CHRYSANTHEMUM_PRESET);
    const legacyPlan = compileFireworkDesign(legacy, 7_260);
    expect(legacyPlan.stars[0]).not.toHaveProperty("effectPhase");
    expect(legacyPlan.stars[0]).not.toHaveProperty("effectSeed");

    const effected = structuredClone(legacy);
    const layer = effected.layers[0]!;
    effected.starDefinitions[layer.defaultStarId].effectProfile = {
      light: { frequencyHz: 6, mode: "strobe" },
    };
    const first = compileFireworkDesign(effected, 7_260);
    const second = compileFireworkDesign(effected, 99_999);
    expect(first.stars[0]).toMatchObject({
      effectPhase: 0,
      effectSeed: expect.any(Number),
    });
    expect(second.stars[0].effectSeed).toBe(first.stars[0].effectSeed);
  });
});
