import { describe, expect, it } from "vitest";

import {
  createPlacementTemplatePoints,
  normalizePlacementFace,
  placementFaceCenter,
  pointOnPlacementFace,
  projectPlacementPoint,
} from "./IntegratedPlacementWorkbench";

describe("IntegratedPlacementWorkbench", () => {
  it("clamps the 4 by 4 placement face and wraps its rotation", () => {
    expect(
      normalizePlacementFace({
        latitudeBand: 9,
        longitudeSector: -2,
        rotationDegrees: -15,
      }),
    ).toEqual({
      latitudeBand: 3,
      longitudeSector: 0,
      rotationDegrees: 345,
    });
  });

  it("creates deterministic circle and heart points on the selected face", () => {
    const face = {
      latitudeBand: 2,
      longitudeSector: 1,
      rotationDegrees: 30,
    };
    const circle = createPlacementTemplatePoints("circle", face, 0.72);
    const heart = createPlacementTemplatePoints("heart", face, 0.72);

    expect(circle).toHaveLength(36);
    expect(heart).toHaveLength(44);
    expect(createPlacementTemplatePoints("heart", face, 0.72)).toEqual(heart);
    [...circle, ...heart].forEach((point) => {
      expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(0.72, 8);
    });
  });

  it("maps manual positions to the same normalized face coordinate system", () => {
    const face = {
      latitudeBand: 0,
      longitudeSector: 3,
      rotationDegrees: 0,
    };
    expect(pointOnPlacementFace(0, 0, face)).toEqual(placementFaceCenter(face));
    const point = pointOnPlacementFace(0.6, -0.4, face, 0.5);
    expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(0.5, 8);
  });

  it("rotates only the workbench projection without mutating its point", () => {
    const point = { x: 1, y: 0.25, z: 0 };
    const before = structuredClone(point);
    const front = projectPlacementPoint(point, 0);
    const side = projectPlacementPoint(point, 90);

    expect(point).toEqual(before);
    expect(front.x).toBeGreaterThan(500);
    expect(side.x).toBeCloseTo(300, 8);
    expect(front.y).toBe(side.y);
  });
});
