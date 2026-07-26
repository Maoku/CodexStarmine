import { describe, expect, it } from "vitest";

import {
  CHRYSANTHEMUM_PRESET,
  POPPING_SHOWER_PRESET,
  type SphericalStarLayer,
} from "../../data";
import { buildEditorDiagnostic } from "./CraftDiagnosticController";
import { CraftDocumentStore } from "./CraftDocumentStore";
import {
  createManualPlacementPoints,
  DEFAULT_MANUAL_PLACEMENT_SETTINGS,
} from "../../ui/craft/ManualPlacementRecipe";
import { pointFromSection } from "../../ui/craft/SliceGeometry";

describe("CraftDocumentStore", () => {
  it("undoes and redoes a layer edit without changing other layers", () => {
    const design = structuredClone(CHRYSANTHEMUM_PRESET);
    const outerBefore = structuredClone(design.layers[0]);
    design.layers.push({
      coloring: { mode: "layer" },
      count: 42,
      defaultStarId: "star-gold",
      id: "test-core",
      ignitionOffset: 0,
      jitter: 0,
      kind: "spherical",
      locked: false,
      missingRate: 0,
      name: "芯 1",
      overrides: [],
      placement: "fibonacci",
      placementSeed: 1,
      radialSpeedScale: 0.38,
      radius: 0.38,
      visible: true,
    });
    const store = new CraftDocumentStore(design);
    store.update("芯を八重芯へ変更", (draft) => {
      (draft.layers[1] as SphericalStarLayer).radius = 0.52;
    });
    expect(store.draft.layers[0]).toEqual(outerBefore);
    expect((store.draft.layers[1] as SphericalStarLayer).radius).toBe(0.52);
    store.undo();
    expect((store.draft.layers[1] as SphericalStarLayer).radius).toBe(0.38);
    store.redo();
    expect((store.draft.layers[1] as SphericalStarLayer).radius).toBe(0.52);
  });

  it("builds an irreversible diagnostic without completed positions", () => {
    const diagnostic = buildEditorDiagnostic(CHRYSANTHEMUM_PRESET);
    expect(diagnostic.colors.length).toBeGreaterThan(0);
    expect(diagnostic.directions.length).toBe(5);
    expect(JSON.stringify(diagnostic)).not.toContain("initialPosition");
    expect(JSON.stringify(diagnostic)).not.toContain("initialVelocity");
  });

  it("counts terminal child particles in the editor load diagnostic", () => {
    const diagnostic = buildEditorDiagnostic(POPPING_SHOWER_PRESET);
    expect(diagnostic.estimatedCost).toMatchObject({
      maximumParticles: 720,
      secondaryParticleCount: 600,
    });
  });

  it("keeps spatial and temporal color settings independent", () => {
    const store = new CraftDocumentStore(CHRYSANTHEMUM_PRESET);
    const definitionBefore = structuredClone(
      Object.values(store.draft.starDefinitions)[0].colorStages,
    );
    store.update("交互色へ変更", (draft) => {
      const layer = draft.layers[0];
      if (layer.kind === "spherical") {
        layer.coloring.mode = "alternating";
        layer.coloring.alternateStarId = "star-change-blue";
      }
    });
    expect(Object.values(store.draft.starDefinitions)[0].colorStages).toEqual(
      definitionBefore,
    );
  });

  it("keeps v4 authoring intent as the editor source of truth", () => {
    const store = new CraftDocumentStore(CHRYSANTHEMUM_PRESET);
    const originalName = store.intentDraft.layers[0].name;

    store.updateIntent("既定レイヤー名を変更", (draft) => {
      draft.layers[0].name = "外周の設計意図";
    });

    expect(store.intentDraft.schemaVersion).toBe(4);
    expect(store.intentDraft.layers[0].authoringMode).toBe("preset");
    expect(store.intentDraft.layers[0].name).toBe("外周の設計意図");
    expect(store.draft.layers[0].name).toBe("外周の設計意図");

    store.undo();
    expect(store.intentDraft.layers[0].name).toBe(originalName);
    store.redo();
    expect(store.intentDraft.layers[0].name).toBe("外周の設計意図");
  });

  it("undoes and redoes an in-document star copy with detailed effects", () => {
    const store = new CraftDocumentStore(CHRYSANTHEMUM_PRESET);
    const sourceId = store.intentDraft.layers[0].defaultStarId;
    const copyId = `${sourceId}-copy-test`;
    store.updateIntent("仮想星を複製して編集", (draft) => {
      const source = draft.starDefinitions[sourceId];
      draft.starDefinitions[copyId] = {
        ...structuredClone(source),
        displayName: `${source.displayName} 複製`,
        effectProfile: {
          ...structuredClone(source.effectProfile ?? {}),
          trail: {
            frequencyHz: 7,
            grainSpacing: 3,
            mode: "granular",
          },
        },
        id: copyId,
        smokeAmount: 0.72,
        trailWidth: 1.6,
      };
      draft.layers[0].defaultStarId = copyId;
    });
    expect(store.intentDraft.layers[0].defaultStarId).toBe(copyId);
    expect(store.draft.starDefinitions[copyId]).toMatchObject({
      effectProfile: { trail: { grainSpacing: 3, mode: "granular" } },
      smokeAmount: 0.72,
      trailWidth: 1.6,
    });
    store.undo();
    expect(store.intentDraft.starDefinitions[copyId]).toBeUndefined();
    store.redo();
    expect(store.intentDraft.layers[0].defaultStarId).toBe(copyId);
  });

  it("treats a manual convenience placement as one undoable operation", () => {
    const store = new CraftDocumentStore(CHRYSANTHEMUM_PRESET);
    store.updateIntent("手動レイヤーを追加", (draft) => {
      draft.layers.push({
        authoringMode: "manual",
        defaultStarId: "star-solid-red",
        id: "manual-test",
        ignitionOffset: 0,
        locked: false,
        name: "手動テスト",
        points: [],
        radialSpeedScale: 1,
        visible: true,
      });
    });
    store.updateIntent("円形配置", (draft) => {
      const layer = draft.layers.find((item) => item.id === "manual-test");
      if (!layer || layer.authoringMode !== "manual") return;
      const section = { plane: "xz" as const, ratio: 0.3 as const };
      layer.points = createManualPlacementPoints("circle", {
        ...DEFAULT_MANUAL_PLACEMENT_SETTINGS,
        count: 36,
      }).map((point, index) => ({
        id: `point-${index}`,
        position: pointFromSection(section, point),
        section,
        starId: layer.defaultStarId,
      }));
    });

    const manualPointCount = () => {
      const layer = store.intentDraft.layers.find(
        (item) => item.id === "manual-test",
      );
      return layer?.authoringMode === "manual" ? layer.points.length : -1;
    };
    expect(manualPointCount()).toBe(36);
    store.undo();
    expect(manualPointCount()).toBe(0);
    store.redo();
    expect(manualPointCount()).toBe(36);
  });
});
