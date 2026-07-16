import { describe, expect, it } from "vitest";

import { FREE_VIEW_PRESET_IDS } from "../../modes/viewFree";
import { renderViewerCameraControl } from "./ViewingStage";

describe("viewer camera controls", () => {
  it("renders the shared presets, reset action, and interaction guidance", () => {
    const markup = renderViewerCameraControl("wide");

    for (const presetId of FREE_VIEW_PRESET_IDS) {
      expect(markup).toContain(`value="${presetId}"`);
    }
    expect(markup).toContain('name="viewer-view-preset"');
    expect(markup).toContain('data-viewer-action="view-reset"');
    expect(markup).toContain("ドラッグ");
    expect(markup).toContain("WASD / 矢印");
    expect(markup).toContain('value="wide" selected');
  });
});
