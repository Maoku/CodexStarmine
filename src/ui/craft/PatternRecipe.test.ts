import { describe, expect, it } from "vitest";

import type { SectionPlane } from "../../data";
import { SECTION_RATIOS, pointToSection } from "./SliceGeometry";
import {
  createNormalizedTemplatePoints,
  createPatternRecipePoints,
  effectivePatternScale,
  PATTERN_TEMPLATES,
  patternScaleLimit,
  patternTemplateVertices,
} from "./PatternRecipe";

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
      expect(points[index].x).toBeCloseTo(-mirror.x, 5);
      expect(points[index].y).toBeCloseTo(mirror.y, 5);
    }
    expect(points[0].y).toBeLessThan(points[10].y);
    expect(points[40].y).toBe(Math.min(...points.map((point) => point.y)));
  });

  it("keeps all templates, densities, and rotations inside the safety margin", () => {
    const planes: SectionPlane[] = ["xy", "xz"];
    planes.forEach((plane) => {
      SECTION_RATIOS.forEach((ratio) => {
        PATTERN_TEMPLATES.forEach((template) => {
          [12, 240].forEach((density) => {
            [0, 37, 143, 359].forEach((rotationDegrees) => {
              const section = { plane, ratio };
              const points = createPatternRecipePoints({
                density,
                rotationDegrees,
                scale: 1,
                section,
                template,
              });
              expect(points).toHaveLength(density);
              const localRadii = points.map(({ position }) => {
                const local = pointToSection(section, position);
                return Math.hypot(local.x, local.y);
              });
              const worldRadii = points.map(({ position }) =>
                Math.hypot(position.x, position.y, position.z),
              );
              expect(Math.max(...localRadii)).toBeLessThanOrEqual(0.940_001);
              expect(Math.max(...worldRadii)).toBeLessThanOrEqual(
                1 + Number.EPSILON,
              );
            });
          });
        });
      });
    });
  });

  it("retains every polygon and star vertex after density resampling", () => {
    (["star", "square", "triangle", "hexagon"] as const).forEach((template) => {
      const points = createNormalizedTemplatePoints(template, 37);
      patternTemplateVertices(template).forEach((vertex) => {
        expect(
          points.some(
            (point) =>
              Math.abs(point.x - vertex.x) < 1e-10 &&
              Math.abs(point.y - vertex.y) < 1e-10,
          ),
        ).toBe(true);
      });
    });
  });

  it("resamples curved templates at nearly equal arc intervals", () => {
    (["circle", "heart"] as const).forEach((template) => {
      const points = createNormalizedTemplatePoints(template, 120);
      const distances = points.map((point, index) => {
        const next = points[(index + 1) % points.length];
        return Math.hypot(next.x - point.x, next.y - point.y);
      });
      const average =
        distances.reduce((sum, distance) => sum + distance, 0) /
        distances.length;
      expect(Math.max(...distances) / average).toBeLessThan(1.03);
      expect(Math.min(...distances) / average).toBeGreaterThan(0.97);
    });
  });

  it("clamps requested size to the shared six-percent slice margin", () => {
    PATTERN_TEMPLATES.forEach((template) => {
      const section = { plane: "xz" as const, ratio: 0.9 as const };
      const limit = patternScaleLimit(section, template);
      expect(limit).toBeCloseTo(0.94, 8);
      expect(
        effectivePatternScale({
          density: 48,
          rotationDegrees: 0,
          scale: 1,
          section,
          template,
        }),
      ).toBeCloseTo(limit, 10);
    });
  });
});
