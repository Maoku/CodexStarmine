import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "../../data";
import {
  computeStarPreviewPosition,
  renderStarLibraryPanel,
  renderStarPreviewOverlay,
} from "./StarLibraryPanel";

describe("StarLibraryPanel", () => {
  it("keeps the preview inside all four viewport corners", () => {
    const viewport = { height: 720, width: 1280 };
    const anchors = [
      { bottom: 48, left: 8, right: 48, top: 8 },
      { bottom: 48, left: 1232, right: 1272, top: 8 },
      { bottom: 712, left: 8, right: 48, top: 672 },
      { bottom: 712, left: 1232, right: 1272, top: 672 },
    ];
    anchors.forEach((anchor) => {
      const position = computeStarPreviewPosition(anchor, viewport);
      expect(position.x).toBeGreaterThanOrEqual(8);
      expect(position.y).toBeGreaterThanOrEqual(8);
      expect(position.x + 260).toBeLessThanOrEqual(viewport.width - 8);
      expect(position.y + 390).toBeLessThanOrEqual(viewport.height - 8);
    });
    expect(computeStarPreviewPosition(anchors[0], viewport).placement).toBe(
      "below",
    );
    expect(computeStarPreviewPosition(anchors[3], viewport).placement).toBe(
      "above",
    );
  });

  it("renders the balloon in a sibling overlay instead of the parts tray", () => {
    const starId = Object.keys(CHRYSANTHEMUM_PRESET.starDefinitions)[0];
    const tray = renderStarLibraryPanel(CHRYSANTHEMUM_PRESET, starId);
    const overlay = renderStarPreviewOverlay(CHRYSANTHEMUM_PRESET, starId, {
      placement: "below",
      x: 12,
      y: 24,
    });

    expect(tray).not.toContain("star-spread-balloon");
    expect(overlay).toContain("star-preview-overlay");
    expect(overlay).toContain('role="dialog"');
    expect(overlay).toContain('data-action="close-star-preview"');
    expect(overlay).toContain("data-star-behavior-preview-host");
    expect(overlay).toContain("data-star-behavior-preview-fallback");
    expect(overlay).toContain('data-action="toggle-star-behavior-preview"');
    expect(overlay).toContain("挙動サンプル");
  });
});
