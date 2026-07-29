import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import {
  BLUE_TIP_WILLOW_PRESET,
  COOL_WATER_RIPPLE_PRESET,
  FIREWORK_PRESETS,
  JAPANESE_SUMMER_PRESETS,
  SUMMER_SUNFLOWER_PRESET,
  WATERMELON_RING_PRESET,
} from "./presets";
import { ensureFireworkDesignV4 } from "./migrations/v3ToV4";

const SUMMER_CHECK_SEED = 7_260_729;

function referencedStarIds(
  preset: (typeof JAPANESE_SUMMER_PRESETS)[number],
): string[] {
  return preset.layers.flatMap((layer) => {
    const alternate =
      layer.kind === "spherical" ? layer.coloring.alternateStarId : undefined;
    const groups =
      layer.kind === "pattern" ? layer.groups.map((group) => group.starId) : [];
    return [layer.defaultStarId, ...(alternate ? [alternate] : []), ...groups];
  });
}

describe("image-derived Japanese summer firework presets", () => {
  it("appends four uniquely identified single-burst works", () => {
    expect(FIREWORK_PRESETS).toHaveLength(28);
    expect(FIREWORK_PRESETS.slice(-4)).toEqual(JAPANESE_SUMMER_PRESETS);
    expect(JAPANESE_SUMMER_PRESETS).toEqual([
      SUMMER_SUNFLOWER_PRESET,
      COOL_WATER_RIPPLE_PRESET,
      BLUE_TIP_WILLOW_PRESET,
      WATERMELON_RING_PRESET,
    ]);
    expect(new Set(FIREWORK_PRESETS.map((preset) => preset.id)).size).toBe(28);
  });

  it("keeps every image-derived virtual star self-contained", () => {
    JAPANESE_SUMMER_PRESETS.forEach((preset) => {
      expect(
        referencedStarIds(preset).every((id) => preset.starDefinitions[id]),
      ).toBe(true);
    });
  });

  it("compiles all four works deterministically within the runtime limit", () => {
    JAPANESE_SUMMER_PRESETS.forEach((preset) => {
      const first = compileFireworkDesign(preset, SUMMER_CHECK_SEED);
      const second = compileFireworkDesign(preset, SUMMER_CHECK_SEED);
      const editable = ensureFireworkDesignV4(preset);
      const editableFirst = compileFireworkDesign(editable, SUMMER_CHECK_SEED);
      const editableSecond = compileFireworkDesign(editable, SUMMER_CHECK_SEED);
      expect(second).toEqual(first);
      expect(editableSecond).toEqual(editableFirst);
      expect(first.estimatedCost.maximumParticles).toBeLessThanOrEqual(6_000);
      expect(editableFirst.estimatedCost.maximumParticles).toBeLessThanOrEqual(
        6_000,
      );
      expect(first.warnings).toEqual([]);
    });
  });

  it("recreates the sunflower as dense gold petals around an amber core", () => {
    const plan = compileFireworkDesign(
      SUMMER_SUNFLOWER_PRESET,
      SUMMER_CHECK_SEED,
    );
    expect(plan.stars).toHaveLength(372);
    expect(new Set(plan.stars.map((star) => star.layerID))).toEqual(
      new Set([
        "layer-sunflower-outer-petals",
        "layer-sunflower-inner-petals",
        "layer-sunflower-amber-core",
      ]),
    );
    expect(
      plan.stars.filter(
        (star) => star.definition.id === "star-summer-sunflower-gold",
      ),
    ).toHaveLength(340);
  });

  it("recreates the water firework as three crisp blue concentric shells", () => {
    const plan = compileFireworkDesign(
      COOL_WATER_RIPPLE_PRESET,
      SUMMER_CHECK_SEED,
    );
    const radialSpeeds = COOL_WATER_RIPPLE_PRESET.layers.flatMap((layer) =>
      layer.kind === "spherical" ? [layer.radialSpeedScale] : [],
    );
    expect(plan.stars).toHaveLength(436);
    expect(radialSpeeds).toEqual([1, 0.64, 0.43]);
    expect(new Set(plan.stars.map((star) => star.definition.id))).toEqual(
      new Set([
        "star-water-ripple-cobalt-tip",
        "star-water-ripple-cyan",
        "star-water-ripple-deep-blue",
      ]),
    );
  });

  it("keeps long gold willow trails and changes their heads to blue", () => {
    const plan = compileFireworkDesign(
      BLUE_TIP_WILLOW_PRESET,
      SUMMER_CHECK_SEED,
    );
    const blueTip =
      BLUE_TIP_WILLOW_PRESET.starDefinitions["star-blue-tip-willow"];
    expect(plan.stars).toHaveLength(228);
    expect(blueTip.trailLifetime).toBe(1);
    expect(
      blueTip.colorStages.some(
        (stage) => stage.normalizedTime >= 0.8 && stage.color === 0x4b9dff,
      ),
    ).toBe(true);
    expect(blueTip.gravityScale).toBeGreaterThan(1.8);
  });

  it("builds the watermelon from green, white, and coral-red shells", () => {
    const plan = compileFireworkDesign(
      WATERMELON_RING_PRESET,
      SUMMER_CHECK_SEED,
    );
    const layerIds = new Set(plan.stars.map((star) => star.layerID));
    expect(layerIds).toEqual(
      new Set([
        "layer-watermelon-green-rind",
        "layer-watermelon-white-rind",
        "layer-watermelon-coral-flesh",
      ]),
    );
    expect(plan.stars).toHaveLength(560);
    expect(
      compileFireworkDesign(
        ensureFireworkDesignV4(WATERMELON_RING_PRESET),
        SUMMER_CHECK_SEED,
      ).stars,
    ).toHaveLength(560);
    expect(
      WATERMELON_RING_PRESET.layers.find(
        (layer) => layer.id === "layer-watermelon-coral-flesh",
      ),
    ).toMatchObject({
      placement: "manual",
      radialSpeedScale: 0.63,
    });
  });
});
