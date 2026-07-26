import { describe, expect, it } from "vitest";

import {
  CHRYSANTHEMUM_PRESET,
  ensureFireworkDesignV3,
  migrateV3ToV4,
  type LayerIntentV4,
} from "../../data";
import { renderSelectedLayerInspector } from "./SelectedLayerInspector";

function designWith(layer: LayerIntentV4) {
  const design = migrateV3ToV4(ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET));
  delete design.legacyIntent;
  design.layers = [layer];
  return design;
}

describe("SelectedLayerInspector", () => {
  it("puts the selected layer name input in the card header", () => {
    const design = migrateV3ToV4(ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET));
    const markup = renderSelectedLayerInspector(design, design.layers[0]);
    const headerEnd = markup.indexOf("</header>");

    expect(markup).toContain("data-selected-layer-inspector");
    expect(markup.indexOf('name="layer-name"')).toBeLessThan(headerEnd);
    expect(markup).toContain('maxlength="24"');
    expect(markup).toContain('name="preset-kind"');
    expect(markup).toContain('name="effect-mapping"');
    expect(markup).toContain('name="effect-direction"');
    expect(markup).toContain('name="effect-spread"');
    expect(markup).toContain('name="effect-cycles"');
    expect(markup).toContain("仮想星の効果を編集");
  });

  it("renders pattern and manual settings without losing their restrictions", () => {
    const pattern: LayerIntentV4 = {
      authoringMode: "pattern",
      defaultStarId: "star-solid-red",
      id: "pattern",
      ignitionOffset: 0,
      locked: false,
      name: "型物",
      pattern: {
        density: 48,
        rotationDegrees: 30,
        scale: 0.7,
        section: { plane: "xy", ratio: 0.5 },
        template: "heart",
      },
      radialSpeedScale: 1,
      visible: true,
    };
    const patternMarkup = renderSelectedLayerInspector(
      designWith(pattern),
      pattern,
    );
    expect(patternMarkup).toContain('name="pattern-scale"');
    expect(patternMarkup).toContain('name="pattern-density"');
    expect(patternMarkup).toContain('name="pattern-rotation"');

    const manual: LayerIntentV4 = {
      authoringMode: "manual",
      defaultStarId: "star-solid-red",
      id: "manual",
      ignitionOffset: 0,
      locked: false,
      name: "手動",
      effectTiming: {
        cycles: 1,
        direction: "forward",
        mapping: "manual",
        offset: 0,
        spread: 1,
      },
      points: [
        {
          effectPhase: 0.42,
          id: "point-1",
          position: { x: 1, y: 0, z: 0 },
          section: { plane: "xy", ratio: 0.5 },
          starId: "star-solid-red",
        },
      ],
      radialSpeedScale: 1,
      visible: true,
    };
    const manualMarkup = renderSelectedLayerInspector(
      designWith(manual),
      manual,
      0,
    );
    expect(manualMarkup).toContain("1点ずつ編集できます");
    expect(manualMarkup).toContain('name="point-effect-phase"');
    expect(manualMarkup).toContain('value="42"');
  });

  it("disables the title and fields when no editable layer is available", () => {
    const design = migrateV3ToV4(ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET));
    const empty = renderSelectedLayerInspector(design, undefined);
    expect(empty).toContain('placeholder="レイヤーを選択"');
    expect(empty).toContain('name="layer-name"');
    expect(empty).toContain("disabled");

    const locked = { ...design.layers[0], locked: true };
    const lockedMarkup = renderSelectedLayerInspector(
      { ...design, layers: [locked] },
      locked,
    );
    expect(lockedMarkup).toContain("ロック中");
    expect(lockedMarkup).toContain('name="layer-star" disabled');
  });
});
