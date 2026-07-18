import { describe, expect, it } from "vitest";

import {
  moveImageCrosshair,
  normalizedImagePoint,
  renderGuidedImagePlacementDialogShell,
} from "./GuidedImagePlacementDialog";

describe("GuidedImagePlacementDialog", () => {
  it("renders an accessible modal with distinct prompt symbols", () => {
    const markup = renderGuidedImagePlacementDialogShell(
      'sample".png',
      128,
      "append",
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('data-input-mode="box"');
    expect(markup).toContain("被写体を囲む");
    expect(markup).toContain('data-prompt-kind="subject"');
    expect(markup).toContain('data-prompt-kind="background"');
    expect(markup).toContain('data-prompt-kind="feature"');
    expect(markup).toContain("＋");
    expect(markup).toContain("−");
    expect(markup).toContain("★");
    expect(markup).toContain('value="128"');
    expect(markup).toContain('<option value="append" selected>追加</option>');
    expect(markup).toContain('alt="sample&quot;.png"');
  });

  it("keeps normalized coordinates independent of rendered size", () => {
    const wide = normalizedImagePoint(300, 250, {
      height: 400,
      left: 100,
      top: 50,
      width: 400,
    });
    const compact = normalizedImagePoint(200, 150, {
      height: 200,
      left: 100,
      top: 50,
      width: 200,
    });
    expect(wide).toEqual({ x: 0.5, y: 0.5 });
    expect(compact).toEqual({ x: 0.5, y: 0.5 });
    expect(
      normalizedImagePoint(-100, 900, {
        height: 100,
        left: 0,
        top: 0,
        width: 100,
      }),
    ).toEqual({ x: 0, y: 1 });
  });

  it("moves and clamps the keyboard crosshair", () => {
    expect(moveImageCrosshair({ x: 0.5, y: 0.5 }, "ArrowLeft")).toEqual({
      x: 0.49,
      y: 0.5,
    });
    expect(moveImageCrosshair({ x: 0.99, y: 0.01 }, "ArrowRight", 0.1)).toEqual(
      { x: 1, y: 0.01 },
    );
    expect(moveImageCrosshair({ x: 0.99, y: 0.01 }, "ArrowUp", 0.1)).toEqual({
      x: 0.99,
      y: 0,
    });
  });
});
