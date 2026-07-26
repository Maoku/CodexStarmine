import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "../../data";
import {
  deriveEffectPhase,
  deriveVirtualBehavior,
} from "./deriveVirtualBehavior";

function input() {
  const layer = CHRYSANTHEMUM_PRESET.layers[0];
  const star = CHRYSANTHEMUM_PRESET.starDefinitions[layer.defaultStarId];
  return {
    assemblySeed: CHRYSANTHEMUM_PRESET.assemblySeed,
    derivationVersion: 1,
    layer,
    localDensity: 0.5,
    normalizedPosition: { x: 1, y: 0, z: 0 },
    placementIndex: 4,
    sizeClass: CHRYSANTHEMUM_PRESET.sizeClass,
    star,
  } as const;
}

describe("deriveVirtualBehavior", () => {
  it("returns the same runtime behavior for the same saved intent", () => {
    expect(deriveVirtualBehavior(input())).toEqual(
      deriveVirtualBehavior(input()),
    );
  });

  it("derives different envelopes from size, position, and star kind", () => {
    const base = deriveVirtualBehavior(input());
    const large = deriveVirtualBehavior({ ...input(), sizeClass: "large" });
    const polar = deriveVirtualBehavior({
      ...input(),
      normalizedPosition: { x: 0, y: 1, z: 0 },
    });
    const gold = CHRYSANTHEMUM_PRESET.starDefinitions["star-gold"];
    const differentStar = deriveVirtualBehavior({ ...input(), star: gold });

    expect(large.baseVelocity).toBeGreaterThan(base.baseVelocity);
    expect(large.radialSpeedScale).toBeGreaterThan(base.radialSpeedScale);
    expect(polar.spreadEnvelope.vertical).not.toBe(
      base.spreadEnvelope.vertical,
    );
    expect(differentStar.gravityScale).not.toBe(base.gravityScale);
  });

  it("uses the selected placement method as design intent", () => {
    const source = input();
    if (source.layer.kind !== "spherical") {
      throw new Error("expected spherical layer");
    }
    const manual = deriveVirtualBehavior({
      ...source,
      layer: { ...source.layer, placement: "manual" },
    });

    expect(manual.radialSpeedScale).not.toBe(
      deriveVirtualBehavior(source).radialSpeedScale,
    );
    expect(manual.placementJitter).toBeGreaterThan(
      deriveVirtualBehavior(source).placementJitter,
    );
  });

  it("rejects an unknown derivation contract", () => {
    expect(() =>
      deriveVirtualBehavior({ ...input(), derivationVersion: 99 }),
    ).toThrow("Unsupported derivation version");
  });
});

describe("deriveEffectPhase", () => {
  const timing = (
    mapping:
      | "index"
      | "longitude"
      | "latitude"
      | "radius"
      | "random"
      | "group"
      | "manual",
    direction: "forward" | "reverse" = "forward",
  ) => ({
    cycles: 1,
    direction,
    mapping,
    offset: 0,
    spread: 1,
  });
  const phase = (
    mapping: Parameters<typeof timing>[0],
    overrides: Partial<Parameters<typeof deriveEffectPhase>[0]> = {},
  ) =>
    deriveEffectPhase({
      assemblySeed: 37,
      layerID: "layer-phase",
      placementCount: 5,
      placementIndex: 2,
      position: { x: 1, y: 0, z: 0 },
      timing: timing(mapping),
      ...overrides,
    });

  it("maps index, longitude, latitude, radius, group, and manual inputs", () => {
    expect(phase("index")).toBe(0.5);
    expect(phase("longitude", { position: { x: 0, y: 0, z: 1 } })).toBe(0.25);
    expect(phase("latitude", { position: { x: 0, y: 1, z: 0 } })).toBe(0);
    expect(
      phase("radius", {
        position: { x: 0.5, y: 0, z: 0 },
        radiusMaximum: 0.8,
        radiusMinimum: 0.2,
      }),
    ).toBeCloseTo(0.5);
    expect(phase("group", { groupCount: 4, groupIndex: 1 })).toBeCloseTo(1 / 3);
    expect(phase("manual", { manualPhase: 0.73 })).toBe(0.73);
    expect(phase("manual")).toBe(0.5);
  });

  it("keeps random mapping stable and applies reverse direction", () => {
    expect(phase("random")).toBe(phase("random"));
    expect(phase("random", { placementIndex: 3 })).not.toBe(phase("random"));
    expect(
      deriveEffectPhase({
        assemblySeed: 37,
        layerID: "layer-phase",
        placementCount: 5,
        placementIndex: 1,
        position: { x: 1, y: 0, z: 0 },
        timing: timing("index", "reverse"),
      }),
    ).toBe(0.75);
  });
});
