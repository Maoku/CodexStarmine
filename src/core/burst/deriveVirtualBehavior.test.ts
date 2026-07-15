import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "../../data";
import { deriveVirtualBehavior } from "./deriveVirtualBehavior";

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
