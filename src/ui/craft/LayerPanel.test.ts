import { describe, expect, it } from "vitest";

import {
  CHRYSANTHEMUM_PRESET,
  ensureFireworkDesignV3,
  migrateV3ToV4,
} from "../../data";
import { renderLayerPanel } from "./LayerPanel";

describe("LayerPanel", () => {
  it("owns layer creation, duplication, and deletion controls", () => {
    const design = migrateV3ToV4(ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET));
    const markup = renderLayerPanel(design, design.layers[0].id);

    expect(markup).toContain("＋ 既定");
    expect(markup).toContain("＋ 型物");
    expect(markup).toContain("＋ 手動");
    expect(markup).toContain("選択レイヤーを複製");
    expect(markup).toContain('data-action="delete-layer"');
    expect(markup).toContain("既定");
  });

  it("renders the preset chooser in the browser top layer", () => {
    const design = migrateV3ToV4(ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET));
    const markup = renderLayerPanel(design, design.layers[0].id);

    expect(markup).toContain('popovertarget="preset-layer-menu"');
    expect(markup).toContain(
      'class="preset-layer-menu" id="preset-layer-menu" popover="auto"',
    );
    expect(markup).not.toContain("<details");
  });
});
