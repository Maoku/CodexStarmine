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
    const view = { pitchDegrees: -60, yawDegrees: 0, zoom: 1 };
    const source = createPlacementTemplatePoints("circle", section)[0];
    const projected = projectSectionPoint(source, section, view);
    const restored = canvasPointOnSection(
      projected.x,
      projected.y,
      section,
      view,
    );
    expect(projected.x).toBeGreaterThan(300);
    expect(projected.distanceFromPlane).toBeCloseTo(0, 8);
    expect(restored.x).toBeCloseTo(0.72, 8);
    expect(restored.y).toBeCloseTo(0, 8);
  });

  it("renders a compact XYZ gizmo with section and zoom controls", () => {
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
    expect(markup).toContain('data-axis="x" data-section-plane="yz"');
    expect(markup).toContain('data-axis="y" data-section-plane="xz"');
    expect(markup).toContain('data-axis="z" data-section-plane="xy"');
    expect(markup).toContain("data-section-step");
    expect(markup).toContain('min="0" max="4" step="1" value="2"');
    expect(markup).toContain("data-workbench-zoom");
    expect(markup).toContain('min="50" max="200" step="10"');
    expect(markup.indexOf("data-section-step")).toBeLessThan(
      markup.indexOf("data-workbench-zoom"),
    );
    expect(markup).not.toContain("data-workbench-pitch");
    expect(markup).not.toContain("data-workbench-yaw");
    expect(markup).not.toContain("上下回転");
    expect(markup).not.toContain("左右回転");
    expect(markup).not.toContain("緯度区画");
    expect(markup).not.toContain("経度区画");
    expect(markup).not.toContain("配置面の回転");
    expect(markup).not.toContain('data-point-editable="true"');
  });

  it("changes shell, section, and depth markup with view-only state", () => {
    const runtime = ensureFireworkDesignV3(CHRYSANTHEMUM_PRESET);
    const intent = migrateV3ToV4(runtime);
    const front = renderIntegratedPlacementWorkbench(
      runtime,
      intent,
      runtime.layers[0],
      intent.layers[0],
      { plane: "xy", ratio: 0.5 },
      "manual",
    );
    const rotated = renderIntegratedPlacementWorkbench(
      runtime,
      intent,
      runtime.layers[0],
      intent.layers[0],
      { plane: "xy", ratio: 0.5 },
      "manual",
      undefined,
      "replace",
      "",
      undefined,
      undefined,
      false,
      { pitchDegrees: 35, yawDegrees: 55, zoom: 1.4 },
    );

    expect(front).toContain('value="100" aria-label="玉の表示倍率"');
    expect(rotated).toContain('value="140" aria-label="玉の表示倍率"');
    expect(rotated).toContain('data-point-depth="');
    expect(rotated).toContain("workbench-sphere-highlight");
    expect(rotated).not.toBe(front);
    expect(intent).toEqual(migrateV3ToV4(runtime));
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
    expect(imageMarkup).toContain('max="2048"');
    expect(imageMarkup).toContain('value="128"');
    expect(imageMarkup).toContain('data-template="image" class="is-active"');
    expect(imageMarkup).not.toContain('data-action="apply-manual-recipe"');
  });
});
