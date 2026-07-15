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
  migrateV3ToV4,
  resolveLayerIntent,
  V3_TO_V4_REGRESSION_SEED,
} from "./v3ToV4";

describe("v3ToV4", () => {
  it("migrates every Phase 0 fixture into a valid v4 intent document", () => {
    const migrated = RENEWAL2_V3_FIXTURES.map(migrateV3ToV4);

    expect(migrated.every(isFireworkDesignV4)).toBe(true);
    expect(migrated.every((design) => design.schemaVersion === 4)).toBe(true);
  });

  it("retains fixed-seed launch output through the legacy comparison intent", () => {
    for (const source of RENEWAL2_V3_FIXTURES) {
      const migrated = migrateV3ToV4(source);
      expect(compileFireworkDesign(migrated, V3_TO_V4_REGRESSION_SEED)).toEqual(
        compileFireworkDesign(source, V3_TO_V4_REGRESSION_SEED),
      );
    }
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
});
