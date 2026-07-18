import { describe, expect, it } from "vitest";

import {
  CHRYSANTHEMUM_PRESET,
  ensureFireworkDesignV3,
  migrateV3ToV4,
  resolveFireworkDesignV4,
} from "../../data";
import {
  canvasPointOnSection,
  createPlacementTemplatePoints,
  projectSectionPoint,
  renderIntegratedPlacementWorkbench,
} from "./IntegratedPlacementWorkbench";

describe("IntegratedPlacementWorkbench", () => {
  it("creates deterministic circle and heart points on the selected section", () => {
    const section = { plane: "xy" as const, ratio: 0.3 as const };
    const circle = createPlacementTemplatePoints("circle", section, 0.72);
    const heart = createPlacementTemplatePoints("heart", section, 0.72);

    expect(circle).toHaveLength(36);
    expect(heart).toHaveLength(44);
    expect(createPlacementTemplatePoints("heart", section, 0.72)).toEqual(
      heart,
    );
    [...circle, ...heart].forEach((point) => {
      expect(Math.hypot(point.x, point.y, point.z)).toBeLessThanOrEqual(0.72);
      expect(point.z).toBeCloseTo(-0.288, 10);
    });
  });

  it("maps canvas and 3D points through the same section coordinate system", () => {
    const section = { plane: "xz" as const, ratio: 0.7 as const };
    const center = canvasPointOnSection(300, 272, section);
    expect(center).toEqual({ x: 0, y: 0 });
    const source = createPlacementTemplatePoints("circle", section)[0];
    const projected = projectSectionPoint(source, section);
    expect(projected.x).toBeGreaterThan(300);
    expect(projected.y).toBeCloseTo(272, 8);
    expect(projected.distanceFromPlane).toBeCloseTo(0, 8);
  });

  it("renders the spatial navigator without numeric section controls", () => {
    const runtime = ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET);
    const intent = migrateV3ToV4(runtime);
    const markup = renderIntegratedPlacementWorkbench(
      runtime,
      intent,
      runtime.layers[0],
      intent.layers[0],
      { plane: "xy", ratio: 0.5 },
      "manual",
      0,
    );

    expect(markup).toContain("data-shell-slice-navigator");
    expect(markup).toContain("slice-disc");
    expect(markup).not.toContain("断面の向き");
    expect(markup).not.toContain("断面位置");
    expect(markup).not.toContain(">XY<");
    expect(markup).not.toContain(">XZ<");
    [10, 30, 50, 70, 90].forEach((ratio) =>
      expect(markup).not.toContain(`>${ratio}%<`),
    );
    expect(markup).not.toContain("緯度区画");
    expect(markup).not.toContain("経度区画");
    expect(markup).not.toContain("配置面の回転");
    expect(markup).not.toContain('data-point-editable="true"');
  });

  it("puts pattern shape controls in the workbench without point operations", () => {
    const intent = migrateV3ToV4(ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET));
    delete intent.legacyIntent;
    intent.layers = [
      {
        authoringMode: "pattern",
        defaultStarId: "star-solid-red",
        id: "pattern-test",
        ignitionOffset: 0,
        locked: false,
        name: "型物テスト",
        pattern: {
          density: 48,
          rotationDegrees: 0,
          scale: 0.7,
          section: { plane: "xy", ratio: 0.5 },
          template: "heart",
        },
        radialSpeedScale: 0.9,
        visible: true,
      },
    ];
    const runtime = resolveFireworkDesignV4(intent);
    const markup = renderIntegratedPlacementWorkbench(
      runtime,
      intent,
      runtime.layers[0],
      intent.layers[0],
      { plane: "xy", ratio: 0.5 },
      "manual",
    );

    ["円形", "ハート", "星形", "四角", "三角", "六角形"].forEach((label) =>
      expect(markup).toContain(`>${label}</button>`),
    );
    expect(markup).toContain('data-action="select-pattern-template"');
    expect(markup).not.toContain('data-action="delete-point"');
    expect(markup).not.toContain('data-action="placement-template"');
    expect(markup).not.toContain('data-action="import-image-placement"');
  });

  it("renders manual assistance and image import only for manual layers", () => {
    const intent = migrateV3ToV4(ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET));
    delete intent.legacyIntent;
    intent.layers = [
      {
        authoringMode: "manual",
        defaultStarId: "star-solid-red",
        id: "manual-test",
        ignitionOffset: 0,
        locked: false,
        name: "手動テスト",
        points: [],
        radialSpeedScale: 1,
        visible: true,
      },
    ];
    const runtime = resolveFireworkDesignV4(intent);
    const markup = renderIntegratedPlacementWorkbench(
      runtime,
      intent,
      runtime.layers[0],
      intent.layers[0],
      { plane: "xy", ratio: 0.5 },
      "grid",
      undefined,
      "append",
    );

    ["円周", "直線", "円弧", "格子"].forEach((label) =>
      expect(markup).toContain(`>${label}</button>`),
    );
    expect(markup).toContain('data-action="import-image-placement"');
    expect(markup).toContain('aria-label="画像から仮想星を生成"');
    expect(markup).toContain('name="manual-rows"');
    expect(markup).toContain('name="manual-columns"');
    expect(markup).toContain('name="manual-spacing"');
    expect(markup).toContain('data-action="apply-manual-recipe"');
    expect(markup).toContain('<option value="append" selected>追加</option>');

    const imageMarkup = renderIntegratedPlacementWorkbench(
      runtime,
      intent,
      runtime.layers[0],
      intent.layers[0],
      { plane: "xy", ratio: 0.5 },
      "image",
      undefined,
      "replace",
      "",
      undefined,
      128,
    );
    expect(imageMarkup).toContain('name="image-target-count"');
    expect(imageMarkup).toContain('max="1024"');
    expect(imageMarkup).toContain('value="128"');
    expect(imageMarkup).toContain('data-template="image" class="is-active"');
    expect(imageMarkup).not.toContain('data-action="apply-manual-recipe"');
  });
});
