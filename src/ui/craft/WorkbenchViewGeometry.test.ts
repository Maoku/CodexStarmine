import { describe, expect, it } from "vitest";

import type { SectionPlane } from "../../data";
import { pointFromSection, SECTION_RATIOS } from "./SliceGeometry";
import {
  clampPointToSectionDisc,
  DEFAULT_WORKBENCH_VIEWPORT,
  normalizeWorkbenchViewState,
  projectWorkbenchPoint,
  projectWorkbenchSectionOutline,
  rotatePointForWorkbenchView,
  stableDepthSort,
  unprojectWorkbenchPointToSection,
  unrotatePointFromWorkbenchView,
  type WorkbenchViewState,
} from "./WorkbenchViewGeometry";

describe("WorkbenchViewGeometry", () => {
  const representativeViews: Record<SectionPlane, WorkbenchViewState[]> = {
    xy: [
      { pitchDegrees: 0, yawDegrees: 0, zoom: 1 },
      { pitchDegrees: 25, yawDegrees: 35, zoom: 0.7 },
    ],
    xz: [
      { pitchDegrees: 35, yawDegrees: 0, zoom: 1 },
      { pitchDegrees: -40, yawDegrees: -55, zoom: 1.8 },
    ],
    yz: [
      { pitchDegrees: 0, yawDegrees: 45, zoom: 1 },
      { pitchDegrees: 25, yawDegrees: 35, zoom: 0.7 },
    ],
  };

  it("keeps the zero view compatible with the original front projection", () => {
    expect(
      projectWorkbenchPoint(
        { x: 0.5, y: -0.25, z: 0.7 },
        { pitchDegrees: 0, yawDegrees: 0, zoom: 1 },
      ),
    ).toMatchObject({
      depth: 0.7,
      x: DEFAULT_WORKBENCH_VIEWPORT.centerX + 112,
      y: DEFAULT_WORKBENCH_VIEWPORT.centerY + 56,
    });
  });

  it("round trips rotation and section projection at representative views", () => {
    const planes: SectionPlane[] = ["xy", "xz", "yz"];
    planes.forEach((plane) => {
      SECTION_RATIOS.forEach((ratio) => {
        representativeViews[plane].forEach((view) => {
          const source = pointFromSection(
            { plane, ratio },
            { x: 0.31, y: -0.27 },
          );
          const rotated = rotatePointForWorkbenchView(source, view);
          const unrotated = unrotatePointFromWorkbenchView(rotated, view);
          expect(unrotated.x).toBeCloseTo(source.x, 10);
          expect(unrotated.y).toBeCloseTo(source.y, 10);
          expect(unrotated.z).toBeCloseTo(source.z, 10);
          const screen = projectWorkbenchPoint(source, view);
          const restored = unprojectWorkbenchPointToSection(
            screen,
            { plane, ratio },
            view,
          );
          expect(restored).toBeDefined();
          if (!restored) throw new Error("section projection was edge-on");
          expect(restored.x).toBeCloseTo(source.x, 8);
          expect(restored.y).toBeCloseTo(source.y, 8);
          expect(restored.z).toBeCloseTo(source.z, 8);
        });
      });
    });
  });

  it("clamps invalid view state and never produces NaN", () => {
    const state = normalizeWorkbenchViewState({
      pitchDegrees: Number.NaN,
      yawDegrees: 999,
      zoom: -4,
    });
    expect(state).toEqual({ pitchDegrees: 0, yawDegrees: 180, zoom: 0.5 });
    expect(
      Object.values(projectWorkbenchPoint({ x: 1, y: 0, z: 0 }, state)).every(
        Number.isFinite,
      ),
    ).toBe(true);
  });

  it("projects a rotated section to a deterministic ellipse-like outline", () => {
    const outline = projectWorkbenchSectionOutline(
      { plane: "xy", ratio: 0.5 },
      { pitchDegrees: 35, yawDegrees: 50, zoom: 1.2 },
    );
    expect(outline).toHaveLength(64);
    const width =
      Math.max(...outline.map(({ x }) => x)) -
      Math.min(...outline.map(({ x }) => x));
    const height =
      Math.max(...outline.map(({ y }) => y)) -
      Math.min(...outline.map(({ y }) => y));
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).not.toBeCloseTo(height, 2);
  });

  it("clamps inverse points to the selected section disc", () => {
    const section = { plane: "yz" as const, ratio: 0.7 as const };
    const clamped = clampPointToSectionDisc({ x: 0.4, y: 3, z: 4 }, section);
    expect(Math.hypot(clamped.x, clamped.y, clamped.z)).toBeLessThanOrEqual(
      1 + Number.EPSILON,
    );
  });

  it("sorts back-to-front and preserves input order for equal depth", () => {
    const values = [
      { depth: 0.4, id: "front" },
      { depth: -0.2, id: "back-a" },
      { depth: -0.2, id: "back-b" },
    ];
    expect(
      stableDepthSort(values, ({ depth }) => depth).map(({ id }) => id),
    ).toEqual(["back-a", "back-b", "front"]);
  });
});
