import { describe, expect, it } from "vitest";

import type { SectionPlane } from "../../data";
import { SECTION_RATIOS, pointToSection } from "./SectionGeometry";
import { createPatternRecipePoints } from "./PatternRecipe";

describe("PatternRecipe", () => {
  it("is deterministic and keeps density order stable", () => {
    const recipe = {
      density: 72,
      rotationDegrees: 15,
      scale: 0.7,
      section: { plane: "xy" as const, ratio: 0.5 as const },
      template: "heart" as const,
    };
    const first = createPatternRecipePoints(recipe);
    expect(first).toHaveLength(72);
    expect(createPatternRecipePoints(recipe)).toEqual(first);
    expect(first.map((point) => point.index)).toEqual(
      Array.from({ length: 72 }, (_, index) => index),
    );
  });

  it("creates a symmetric upright heart with a notch and bottom tip", () => {
    const section = { plane: "xy" as const, ratio: 0.5 as const };
    const points = createPatternRecipePoints({
      density: 80,
      rotationDegrees: 0,
      scale: 0.8,
      section,
      template: "heart",
    }).map((point) => pointToSection(section, point.position));
    for (let index = 1; index < 40; index += 1) {
      const mirror = points[80 - index];
      expect(points[index].x).toBeCloseTo(-mirror.x, 8);
      expect(points[index].y).toBeCloseTo(mirror.y, 8);
    }
    expect(points[0].y).toBeLessThan(points[10].y);
    expect(points[40].y).toBe(Math.min(...points.map((point) => point.y)));
  });

  it("keeps minimum and maximum sizes inside every XY and XZ section", () => {
    const planes: SectionPlane[] = ["xy", "xz"];
    planes.forEach((plane) => {
      SECTION_RATIOS.forEach((ratio) => {
        [0.15, 0.95].forEach((scale) => {
          createPatternRecipePoints({
            density: 48,
            rotationDegrees: 225,
            scale,
            section: { plane, ratio },
            template: "heart",
          }).forEach(({ position }) => {
            expect(
              Math.hypot(position.x, position.y, position.z),
            ).toBeLessThanOrEqual(1 + Number.EPSILON);
          });
        });
      });
    });
  });
});
