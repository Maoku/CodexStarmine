import { describe, expect, it } from "vitest";

import { generateHeartBurst, generatePalmBurst } from "./shapes";

describe("pattern point generators", () => {
  it("keeps the heart in a camera-facing plane with a center notch", () => {
    const points = generateHeartBurst(120, 8);
    expect(points).toHaveLength(120);
    expect(
      Math.max(...points.map((point) => Math.abs(point.direction.z))),
    ).toBeLessThan(0.013);
    const topCenter = points.filter(
      (point) => Math.abs(point.direction.x) < 0.08 && point.direction.y > 0,
    );
    expect(topCenter.length).toBeGreaterThan(0);
  });

  it("creates a small number of thick palm branches", () => {
    const points = generatePalmBurst(70, 9);
    expect(points.length).toBeGreaterThanOrEqual(60);
    expect(points.length).toBeLessThanOrEqual(90);
    expect(points.every((point) => point.direction.y > 0.1)).toBe(true);
  });
});
