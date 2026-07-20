import { describe, expect, it } from "vitest";

import type { SectionPlane } from "../../data";
import {
  SECTION_RATIOS,
  clampSectionPoint,
  fixedCoordinate,
  pointFromSection,
  pointToSection,
  sectionPlaneForAxis,
  sectionRadius,
  sectionRatioAt,
  sectionRatioIndex,
  sliceFrame,
  stepSection,
} from "./SliceGeometry";

describe("SliceGeometry", () => {
  const planes: SectionPlane[] = ["xy", "xz", "yz"];

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

  it("fixes the coordinate normal to every plane while staying inside the sphere", () => {
    planes.forEach((plane) => {
      SECTION_RATIOS.forEach((ratio) => {
        const section = { plane, ratio };
        const point = pointFromSection(section, { x: 0.72, y: 0.44 });
        const fixed = fixedCoordinate(section);
        const fixedValue =
          plane === "xy" ? point.z : plane === "xz" ? point.y : point.x;
        expect(fixedValue).toBeCloseTo(fixed, 10);
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

  it("provides a stable local frame and direct-operation steps", () => {
    const section = { plane: "xy" as const, ratio: 0.5 as const };
    expect(sliceFrame(section)).toEqual({
      center: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
      radius: 1,
      tangentX: { x: 1, y: 0, z: 0 },
      tangentY: { x: 0, y: 1, z: 0 },
    });
    expect(stepSection(section, 1, 1)).toEqual({
      plane: "xz",
      ratio: 0.7,
    });
    expect(stepSection({ plane: "xz", ratio: 0.9 }, 0, 1)).toEqual({
      plane: "xz",
      ratio: 0.9,
    });
    expect(stepSection({ plane: "xz", ratio: 0.5 }, 1, 0)).toEqual({
      plane: "yz",
      ratio: 0.5,
    });
  });

  it("maps X/Y/Z to YZ/XZ/XY and keeps five ratio indices exact", () => {
    expect(sectionPlaneForAxis("x")).toBe("yz");
    expect(sectionPlaneForAxis("y")).toBe("xz");
    expect(sectionPlaneForAxis("z")).toBe("xy");
    SECTION_RATIOS.forEach((ratio, index) => {
      expect(sectionRatioAt(index)).toBe(ratio);
      expect(sectionRatioIndex(ratio)).toBe(index);
    });
    expect(sectionRatioAt(-10)).toBe(0.1);
    expect(sectionRatioAt(10)).toBe(0.9);
  });

  it("defines the YZ frame around the fixed X coordinate", () => {
    const frame = sliceFrame({ plane: "yz", ratio: 0.7 });
    expect(frame.center.x).toBeCloseTo(0.4, 10);
    expect(frame.radius).toBeCloseTo(Math.sqrt(0.84), 10);
    expect(frame).toMatchObject({
      center: { y: 0, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      tangentX: { x: 0, y: 0, z: 1 },
      tangentY: { x: 0, y: 1, z: 0 },
    });
  });
});
