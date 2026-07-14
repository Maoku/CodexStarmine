import { describe, expect, it } from "vitest";

import { generateSphereBurst } from "./sphere";

describe("generateSphereBurst", () => {
  it("creates the requested number of unit directions", () => {
    const burst = generateSphereBurst(120, 1, 42);
    expect(burst).toHaveLength(120);
    for (const seed of burst) {
      expect(
        Math.hypot(seed.direction.x, seed.direction.y, seed.direction.z),
      ).toBeCloseTo(1, 5);
    }
  });

  it("is deterministic for replay and testing", () => {
    expect(generateSphereBurst(8, 0.8, 7)).toEqual(
      generateSphereBurst(8, 0.8, 7),
    );
  });

  it("keeps the mean direction close to the sphere center", () => {
    const burst = generateSphereBurst(240, 1, 5);
    const mean = burst.reduce(
      (total, seed) => ({
        x: total.x + seed.direction.x / burst.length,
        y: total.y + seed.direction.y / burst.length,
        z: total.z + seed.direction.z / burst.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
    expect(Math.hypot(mean.x, mean.y, mean.z)).toBeLessThan(0.02);
  });
});
