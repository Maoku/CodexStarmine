import { describe, expect, it } from "vitest";

import { snapshotStarLibrary } from "../../data";
import {
  imageSegmentationRuntimeLabel,
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
    expect(markup).toContain(
      'data-input-mode="feature" data-prompt-kind="feature" aria-pressed="false" hidden',
    );
    expect(markup).toContain("＋");
    expect(markup).toContain("−");
    expect(markup).toContain("★");
    expect(markup).toContain('value="128"');
    expect(markup).toContain('max="2048"');
    expect(markup).toContain('type="range"');
    expect(markup).toContain('step="8"');
    expect(markup).toContain('aria-valuetext="128点"');
    expect(markup).toContain(
      '<option value="outline-internal-boundary" selected>輪郭＋内部境界</option>',
    );
    expect(markup).toContain(
      '<option value="outline-internal-boundary-filled" >輪郭＋内部境界＋内部</option>',
    );
    expect(markup).toContain('<option value="append" selected>追加</option>');
    expect(markup).toContain('alt="sample&quot;.png"');
  });

  it("renders the interior fill placement mode as selected", () => {
    const markup = renderGuidedImagePlacementDialogShell(
      "filled.png",
      1024,
      "replace",
      "outline-internal-boundary-filled",
    );

    expect(markup).toContain(
      '<option value="outline-internal-boundary-filled" selected>輪郭＋内部境界＋内部</option>',
    );
    expect(markup).toContain('value="1024"');
  });

  it("keeps processing status in the footer with accessible progress", () => {
    const markup = renderGuidedImagePlacementDialogShell(
      "status.png",
      1024,
      "replace",
    );
    const header = markup.slice(
      markup.indexOf('<header class="guided-image-dialog-header">'),
      markup.indexOf("</header>"),
    );
    const footer = markup.slice(
      markup.indexOf('<footer class="guided-image-dialog-footer">'),
    );

    expect(header).not.toContain("data-guided-status");
    expect(footer).toContain('role="status"');
    expect(footer).toContain("data-guided-status");
    expect(footer).toContain("data-guided-progress");
    expect(footer).toContain("guided-image-spinner");
    expect(markup).toContain("data-guided-point-legend");
  });

  it("renders an eight-color image palette and a separate outline star", () => {
    const markup = renderGuidedImagePlacementDialogShell(
      "palette.png",
      240,
      "replace",
      "outline",
      {
        enhanceDarkColors: false,
        imageStarKind: "trail",
        outlineStarId: "star-gold",
        starDefinitions: snapshotStarLibrary(),
      },
    );

    expect(markup).toContain("内部・特徴を8色以内にまとめます");
    expect(markup).toContain('name="guided-image-star-kind"');
    expect(markup).toContain('<option value="solid" >単色星</option>');
    expect(markup).toContain('<option value="changing" >変化星</option>');
    expect(markup).toContain('<option value="trail" selected>引星</option>');
    expect(markup).toContain('name="guided-enhance-dark-colors"');
    expect(markup).not.toContain(
      'name="guided-enhance-dark-colors" type="checkbox" checked',
    );
    expect(markup).toContain('name="guided-outline-star"');
    expect(markup).toContain('value="star-gold" selected');
    expect(markup).not.toContain('name="guided-outline-color-source"');
    expect(markup).not.toContain('name="guided-outline-color-count"');
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

  it("labels the image segmentation provider and its actual runtime", () => {
    expect(imageSegmentationRuntimeLabel("slimsam", "webgpu")).toBe(
      "画像解析: SlimSAM / WebGPU (fp16)",
    );
    expect(imageSegmentationRuntimeLabel("slimsam", "wasm")).toBe(
      "画像解析: SlimSAM / WASM (q8)",
    );
    expect(imageSegmentationRuntimeLabel("fast", "cpu")).toBe(
      "画像解析: 高速方式 / CPU",
    );
    expect(imageSegmentationRuntimeLabel("alpha", "none")).toBe(
      "画像解析: アルファ / モデル不使用",
    );
  });
});
