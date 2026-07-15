import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../../core/burst";
import { CHRYSANTHEMUM_PRESET, HEART_PRESET } from "../presets";
import {
  migrateV2ToV3,
  restoreLegacyV2Design,
  V2_TO_V3_REGRESSION_SEED,
} from "./v2ToV3";

describe("v2ToV3", () => {
  it("keeps a reversible legacy behavior snapshot", () => {
    const migrated = migrateV2ToV3(HEART_PRESET);
    const restored = restoreLegacyV2Design(migrated);

    expect(migrated).toMatchObject({
      derivationVersion: 1,
      schemaVersion: 3,
    });
    expect(restored).toEqual(HEART_PRESET);
    expect(compileFireworkDesign(restored!, V2_TO_V3_REGRESSION_SEED)).toEqual(
      compileFireworkDesign(HEART_PRESET, V2_TO_V3_REGRESSION_SEED),
    );
  });

  it("compiles v3 from intent and ignores migrated low-level shadows", () => {
    const migrated = migrateV2ToV3(HEART_PRESET);
    const changedShadows = structuredClone(migrated);
    changedShadows.burstField.baseVelocity = 999;
    changedShadows.launchVariation = {
      ignition: 0.2,
      lifetime: 0.2,
      placement: 0.2,
      velocity: 0.2,
    };
    changedShadows.realism.missingRate = 0.5;
    const pattern = changedShadows.layers[0];
    if (pattern.kind !== "pattern") throw new Error("expected pattern");
    pattern.allowedAngle = 1;
    pattern.ignitionOffset = 10;
    pattern.orientationDegrees = 180;
    pattern.radialSpeedScale = 0.01;
    pattern.rotationJitter = 90;

    expect(compileFireworkDesign(changedShadows, 77)).toEqual(
      compileFireworkDesign(migrated, 77),
    );
  });

  it("changes v3 runtime output when visual intent changes", () => {
    const migrated = migrateV2ToV3(HEART_PRESET);
    const large = { ...structuredClone(migrated), sizeClass: "large" as const };

    expect(compileFireworkDesign(large, 77)).not.toEqual(
      compileFireworkDesign(migrated, 77),
    );
  });

  it("keeps assembly membership stable across small launch variation", () => {
    const migrated = migrateV2ToV3(CHRYSANTHEMUM_PRESET);
    const first = compileFireworkDesign(migrated, 11);
    const second = compileFireworkDesign(migrated, 12);

    expect(second.stars.map((star) => star.id)).toEqual(
      first.stars.map((star) => star.id),
    );
    expect(second).not.toEqual(first);
  });
});
