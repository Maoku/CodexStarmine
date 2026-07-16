import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import {
  DesignRepository,
  type LayerIntentV4,
  type PatternTemplate,
  type StorageLike,
} from "../data";
import { CraftController } from "../modes/craft";
import {
  createManualPlacementPoints,
  DEFAULT_MANUAL_PLACEMENT_SETTINGS,
} from "../ui/craft/ManualPlacementRecipe";
import { pointFromSection } from "../ui/craft/SliceGeometry";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function patternLayer(
  template: PatternTemplate,
  starId: string,
): LayerIntentV4 {
  return {
    authoringMode: "pattern",
    defaultStarId: starId,
    id: `integration-${template}`,
    ignitionOffset: 0,
    locked: false,
    name: `${template} 型物`,
    pattern: {
      density: 48,
      rotationDegrees: template === "square" ? 18 : 0,
      scale: 0.82,
      section: { plane: "xy", ratio: 0.5 },
      template,
    },
    radialSpeedScale: 1,
    visible: true,
  };
}

describe("Renewal3 creation-to-check integration", () => {
  it("reloads heart, star, square, and manual-line intent from migrated work", () => {
    const storage = memoryStorage();
    const controller = new CraftController(
      new DesignRepository(storage, () => "renewal3-migrated"),
    );
    const starId = Object.keys(controller.intentDraft.starDefinitions)[0];
    const section = { plane: "xy", ratio: 0.5 } as const;
    const line = createManualPlacementPoints("line", {
      ...DEFAULT_MANUAL_PLACEMENT_SETTINGS,
      count: 9,
      length: 1.4,
    }).map((point) => pointFromSection(section, point));
    controller.document.updateIntent("Renewal3統合形状を作成", (draft) => {
      draft.name = "Renewal3 統合形状";
      draft.layers = [
        patternLayer("heart", starId),
        patternLayer("star", starId),
        patternLayer("square", starId),
        {
          authoringMode: "manual",
          defaultStarId: starId,
          id: "integration-manual-line",
          ignitionOffset: 0,
          locked: false,
          name: "手動直線",
          points: line.map((point, index) => ({
            id: `line-${index}`,
            position: point,
            section,
            starId,
          })),
          radialSpeedScale: 1,
          visible: true,
        },
      ];
    });
    const saved = controller.save();

    const reloaded = new CraftController(new DesignRepository(storage));
    expect(reloaded.load(saved.id)).toBe(true);
    expect(
      reloaded.intentDraft.layers.map((layer) => layer.authoringMode),
    ).toEqual(["pattern", "pattern", "pattern", "manual"]);
    expect(
      reloaded.intentDraft.layers
        .filter((layer) => layer.authoringMode === "pattern")
        .map((layer) => layer.pattern.template),
    ).toEqual(["heart", "star", "square"]);
    expect(reloaded.intentDraft.layers[3]).toMatchObject({
      authoringMode: "manual",
      points: expect.arrayContaining([
        expect.objectContaining({ position: line[0] }),
        expect.objectContaining({ position: line.at(-1) }),
      ]),
    });

    const plan = compileFireworkDesign(reloaded.intentDraft, 0x5233_4348);
    expect(new Set(plan.stars.map((star) => star.layerID))).toEqual(
      new Set(reloaded.intentDraft.layers.map((layer) => layer.id)),
    );
  });

  it("round-trips current v4 intent created from a new blank work", () => {
    const storage = memoryStorage();
    const controller = new CraftController(
      new DesignRepository(storage, () => "renewal3-new"),
    );
    controller.startNewDraft("small", "blank");
    controller.updateName("Renewal3 新規作品");
    controller.document.updateIntent("新規作品へ星型を配置", (draft) => {
      const starId = Object.keys(draft.starDefinitions)[0];
      draft.layers = [patternLayer("star", starId)];
    });
    const saved = controller.save();

    const reloaded = new CraftController(new DesignRepository(storage));
    expect(reloaded.load(saved.id)).toBe(true);
    expect(reloaded.intentDraft).toMatchObject({
      name: "Renewal3 新規作品",
      schemaVersion: 4,
      sizeClass: "small",
    });
    expect(reloaded.intentDraft.layers[0]).toMatchObject({
      authoringMode: "pattern",
      pattern: { template: "star" },
    });
    expect(compileFireworkDesign(reloaded.intentDraft, 7).stars).toHaveLength(
      48,
    );
  });
});
