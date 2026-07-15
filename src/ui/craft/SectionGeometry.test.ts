import { describe, expect, it } from "vitest";

import type { SectionPlane } from "../../data";
import {
  SECTION_RATIOS,
  clampSectionPoint,
  fixedCoordinate,
  pointFromSection,
  pointToSection,
  sectionRadius,
} from "./SectionGeometry";

describe("SectionGeometry", () => {
  const planes: SectionPlane[] = ["xy", "xz"];

  it("derives symmetric fixed coordinates and slice radii for all 10 sections", () => {
    planes.forEach((plane) => {
      const sections = SECTION_RATIOS.map((ratio) => ({ plane, ratio }));
      [-0.8, -0.4, 0, 0.4, 0.8].forEach((expected, index) => {
        expect(fixedCoordinate(sections[index])).toBeCloseTo(expected, 10);
      });
      expect(sectionRadius(sections[0])).toBeCloseTo(0.6, 10);
      expect(sectionRadius(sections[2])).toBeCloseTo(1, 10);
      expect(sectionRadius(sections[4])).toBeCloseTo(0.6, 10);
    });
  });

  it("round trips normalized section coordinates", () => {
    planes.forEach((plane) => {
      SECTION_RATIOS.forEach((ratio) => {
        const section = { plane, ratio };
        const source = { x: 0.42, y: -0.31 };
        const projected = pointToSection(
          section,
          pointFromSection(section, source),
        );
        expect(projected.x).toBeCloseTo(source.x, 10);
        expect(projected.y).toBeCloseTo(source.y, 10);
        expect(projected.distanceFromPlane).toBeCloseTo(0, 10);
      });
    });
  });

  it("fixes z for XY and y for XZ while staying inside the sphere", () => {
    planes.forEach((plane) => {
      SECTION_RATIOS.forEach((ratio) => {
        const section = { plane, ratio };
        const point = pointFromSection(section, { x: 0.72, y: 0.44 });
        const fixed = fixedCoordinate(section);
        expect(plane === "xy" ? point.z : point.y).toBeCloseTo(fixed, 10);
        expect(Math.hypot(point.x, point.y, point.z)).toBeLessThanOrEqual(
          1 + Number.EPSILON,
        );
      });
    });
  });

  it("clamps canvas points to the section circle", () => {
    expect(clampSectionPoint({ x: 2, y: 0 })).toEqual({ x: 1, y: 0 });
    const diagonal = clampSectionPoint({ x: 1, y: 1 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 10);
  });
});
