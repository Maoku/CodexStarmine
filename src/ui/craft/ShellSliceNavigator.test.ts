import { describe, expect, it } from "vitest";

import {
  renderShellSliceNavigator,
  sectionAfterNavigatorDrag,
} from "./ShellSliceNavigator";

describe("ShellSliceNavigator", () => {
  it("renders a shell, selected disc, and labeled XYZ gizmo", () => {
    const markup = renderShellSliceNavigator({ plane: "xy", ratio: 0.5 });
    expect(markup).toContain("slice-shell");
    expect(markup).toContain("slice-disc");
    expect(markup).toContain(">X<");
    expect(markup).toContain(">Y<");
    expect(markup).toContain(">Z<");
    expect(markup).toContain('data-axis="x" data-section-plane="yz"');
    expect(markup).toContain('data-axis="y" data-section-plane="xz"');
    expect(markup).toContain(
      'data-axis="z" data-section-plane="xy" aria-label="Z軸に直交するXY面" aria-pressed="true"',
    );
  });

  it("maps horizontal rotation and vertical travel to compatible sections", () => {
    const source = { plane: "xy" as const, ratio: 0.5 as const };
    expect(sectionAfterNavigatorDrag(source, 40, 0)).toEqual({
      plane: "xz",
      ratio: 0.5,
    });
    expect(
      sectionAfterNavigatorDrag({ plane: "xz", ratio: 0.5 }, 40, 0),
    ).toEqual({
      plane: "yz",
      ratio: 0.5,
    });
    expect(sectionAfterNavigatorDrag(source, 0, -30)).toEqual({
      plane: "xy",
      ratio: 0.7,
    });
    expect(sectionAfterNavigatorDrag(source, 4, 5)).toEqual(source);
  });
});
