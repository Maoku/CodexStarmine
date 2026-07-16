import { describe, expect, it } from "vitest";

import {
  createManualPlacementPoints,
  DEFAULT_MANUAL_PLACEMENT_SETTINGS,
} from "./ManualPlacementRecipe";

describe("ManualPlacementRecipe", () => {
  it("creates deterministic circle points with the requested radius", () => {
    const settings = { ...DEFAULT_MANUAL_PLACEMENT_SETTINGS, count: 18 };
    const points = createManualPlacementPoints("circle", settings);
    expect(points).toHaveLength(18);
    expect(createManualPlacementPoints("circle", settings)).toEqual(points);
    points.forEach((point) =>
      expect(Math.hypot(point.x, point.y)).toBeCloseTo(settings.radius, 10),
    );
  });

  it("includes both endpoints of line and arc recipes", () => {
    const settings = {
      ...DEFAULT_MANUAL_PLACEMENT_SETTINGS,
      angleDegrees: 0,
      count: 5,
      endAngleDegrees: 90,
      length: 1.2,
      radius: 0.8,
      startAngleDegrees: 0,
    };
    const line = createManualPlacementPoints("line", settings);
    expect(line[0]).toEqual({ x: -0.6, y: 0 });
    expect(line[4]).toEqual({ x: 0.6, y: 0 });
    const arc = createManualPlacementPoints("arc", settings);
    expect(arc[0]).toEqual({ x: 0.8, y: 0 });
    expect(arc[4].x).toBeCloseTo(0, 10);
    expect(arc[4].y).toBeCloseTo(0.8, 10);
  });

  it("keeps only in-slice grid points after rotation", () => {
    const points = createManualPlacementPoints("grid", {
      ...DEFAULT_MANUAL_PLACEMENT_SETTINGS,
      columns: 9,
      rotationDegrees: 37,
      rows: 9,
      spacing: 0.25,
    });
    expect(points.length).toBeGreaterThan(20);
    expect(points.length).toBeLessThan(81);
    expect(
      Math.max(...points.map((point) => Math.hypot(point.x, point.y))),
    ).toBeLessThanOrEqual(0.940_000_000_1);
  });
});
