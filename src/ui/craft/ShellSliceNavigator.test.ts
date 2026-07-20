import { describe, expect, it } from "vitest";

import { renderShellSliceNavigator } from "./ShellSliceNavigator";

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
    expect(markup).toContain('role="group" aria-label="操作面を選択"');
    expect(markup).not.toContain('tabindex="0"');
    expect(markup).not.toContain("ドラッグ");
  });
});
