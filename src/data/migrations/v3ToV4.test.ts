import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../../core/burst";
import {
  RENEWAL2_CHILD_FIXTURE,
  RENEWAL2_CORE_FIXTURE,
  RENEWAL2_HEART_PATTERN_FIXTURE,
  RENEWAL2_MANUAL_OVERRIDE_FIXTURE,
  RENEWAL2_V3_FIXTURES,
} from "../../test/fixtures/renewal2Baseline";
import { isFireworkDesignV4, type PatternLayerIntent } from "../firework";
import {
  compareLegacyEnvelope,
  migrateV3ToV4,
  resolveCurrentIntent,
  resolveLayerIntent,
  V3_TO_V4_REGRESSION_SEED,
} from "./v3ToV4";

describe("v3ToV4", () => {
  it("migrates every Phase 0 fixture into a valid v4 intent document", () => {
    const migrated = RENEWAL2_V3_FIXTURES.map(migrateV3ToV4);

    expect(migrated.every(isFireworkDesignV4)).toBe(true);
    expect(migrated.every((design) => design.schemaVersion === 4)).toBe(true);
  });

  it("uses current layers for execution and keeps legacy intent comparison-only", () => {
    const migrated = migrateV3ToV4(RENEWAL2_CORE_FIXTURE);
    const layer = migrated.layers[0];
    if (!layer || layer.authoringMode !== "preset") {
      throw new Error("expected preset layer");
    }
    layer.parameters.count += 7;

    const resolved = resolveCurrentIntent(migrated);
    const comparison = compareLegacyEnvelope(migrated, resolved);

    expect(resolved.layers[0]).toMatchObject({ count: layer.parameters.count });
    expect(comparison.hasLegacyIntent).toBe(true);
    expect(comparison.changedLayerIds).toContain(layer.id);
    expect(
      compileFireworkDesign(migrated, V3_TO_V4_REGRESSION_SEED),
    ).not.toEqual(
      compileFireworkDesign(migrated.legacyIntent!, V3_TO_V4_REGRESSION_SEED),
    );
  });

  it("classifies explicit point clouds as manual and regular layers as presets", () => {
    const pattern = migrateV3ToV4(RENEWAL2_HEART_PATTERN_FIXTURE);
    const override = migrateV3ToV4(RENEWAL2_MANUAL_OVERRIDE_FIXTURE);
    const core = migrateV3ToV4(RENEWAL2_CORE_FIXTURE);
    const child = migrateV3ToV4(RENEWAL2_CHILD_FIXTURE);

    expect(pattern.layers[0]?.authoringMode).toBe("manual");
    expect(override.layers[0]?.authoringMode).toBe("manual");
    expect(core.layers[0]).toMatchObject({
      authoringMode: "preset",
      presetKind: "core",
    });
    expect(child.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authoringMode: "preset",
          presetKind: "child",
        }),
      ]),
    );
  });

  it("resolves a new pattern recipe deterministically without saved generated points", () => {
    const source = migrateV3ToV4(RENEWAL2_HEART_PATTERN_FIXTURE);
    const firstLayer = source.layers[0];
    const intent: PatternLayerIntent = {
      defaultStarId: firstLayer.defaultStarId,
      id: "new-heart-pattern",
      ignitionOffset: 0,
      locked: false,
      name: "ハート",
      radialSpeedScale: 1,
      visible: true,
      authoringMode: "pattern",
      pattern: {
        density: 48,
        rotationDegrees: 0,
        scale: 0.72,
        section: { plane: "xy", ratio: 0.5 },
        template: "heart",
      },
    };

    expect(Object.hasOwn(intent.pattern, "points")).toBe(false);
    expect(resolveLayerIntent(intent)).toEqual(resolveLayerIntent(intent));
    expect(resolveLayerIntent(intent)).toMatchObject({
      count: 48,
      kind: "spherical",
      placement: "manual",
    });
  });

  it("preserves optional layer timing and manual point phases", () => {
    const migrated = migrateV3ToV4(RENEWAL2_MANUAL_OVERRIDE_FIXTURE);
    const layer = migrated.layers[0]!;
    layer.effectTiming = {
      cycles: 2,
      direction: "reverse",
      mapping: "manual",
      offset: 0.15,
      spread: 0.8,
    };
    if (layer.authoringMode !== "manual" || !layer.points[0]) {
      throw new Error("expected a manual layer");
    }
    layer.points[0].effectPhase = 0.42;

    const resolved = resolveLayerIntent(layer);
    expect(resolved.effectTiming).toEqual(layer.effectTiming);
    expect(
      resolved.kind === "spherical" ? resolved.overrides[0] : undefined,
    ).toMatchObject({ effectPhase: 0.42 });
  });

  it("preserves legacy manual override phases while migrating to v4 points", () => {
    const source = structuredClone(RENEWAL2_MANUAL_OVERRIDE_FIXTURE);
    const layer = source.layers[0];
    if (!layer || layer.kind !== "spherical" || !layer.overrides[0]) {
      throw new Error("expected a spherical layer with a manual override");
    }
    layer.overrides[0].effectPhase = 0.37;

    const migrated = migrateV3ToV4(source);
    const migratedLayer = migrated.layers[0];
    expect(
      migratedLayer?.authoringMode === "manual"
        ? migratedLayer.points[0]
        : undefined,
    ).toMatchObject({ effectPhase: 0.37 });
  });
});
