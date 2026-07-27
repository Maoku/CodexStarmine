import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import {
  BLUE_RIPPLE_PRESET,
  FIREFLY_SENRIN_PRESET,
  FIREWORK_PRESETS,
  JAPANESE_SUMMER_PRESETS,
  MORNING_GLORY_PRESET,
  SUMMER_SHOWER_WILLOW_PRESET,
} from "./presets";
import { ensureFireworkDesignV4 } from "./migrations/v3ToV4";
import { BUILTIN_STAR_PRESETS } from "./starPresets";

const SUMMER_CHECK_SEED = 7_260_726;

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

describe("Japanese summer firework presets", () => {
  it("appends four uniquely identified works without disturbing the prefix", () => {
    expect(FIREWORK_PRESETS).toHaveLength(29);
    expect(FIREWORK_PRESETS.slice(-4)).toEqual(JAPANESE_SUMMER_PRESETS);
    expect(JAPANESE_SUMMER_PRESETS).toEqual([
      MORNING_GLORY_PRESET,
      FIREFLY_SENRIN_PRESET,
      BLUE_RIPPLE_PRESET,
      SUMMER_SHOWER_WILLOW_PRESET,
    ]);
    expect(new Set(FIREWORK_PRESETS.map((preset) => preset.id)).size).toBe(29);
  });

  it("composes every layer exclusively from the built-in virtual stars", () => {
    const builtInIds = new Set(BUILTIN_STAR_PRESETS.map((star) => star.id));
    JAPANESE_SUMMER_PRESETS.forEach((preset) => {
      expect(referencedStarIds(preset).every((id) => builtInIds.has(id))).toBe(
        true,
      );
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
      expect(first.warnings).not.toContain(
        "実行上限6,000星を超えます。星数または子花数を減らしてください。",
      );
    });
  });

  it("gives the morning glory three distinct virtual-star layers", () => {
    const plan = compileFireworkDesign(MORNING_GLORY_PRESET, SUMMER_CHECK_SEED);
    expect(new Set(plan.stars.map((star) => star.definition.id))).toEqual(
      new Set([
        "star-repeat-change",
        "star-change-blue",
        "star-gradient-fade",
        "star-teka",
      ]),
    );
    expect(new Set(plan.stars.map((star) => star.layerID)).size).toBe(3);
  });

  it("opens fourteen randomly phased firefly child blooms", () => {
    const plan = compileFireworkDesign(
      FIREFLY_SENRIN_PRESET,
      SUMMER_CHECK_SEED,
    );
    expect(plan.childBursts).toHaveLength(14);
    expect(
      plan.childBursts.every((burst) =>
        burst.stars.every(
          (star) => star.definition.id === "star-strobe-pastel",
        ),
      ),
    ).toBe(true);
    expect(
      new Set(
        plan.childBursts.flatMap((burst) =>
          burst.stars.map((star) => star.effectPhase),
        ),
      ).size,
    ).toBeGreaterThan(12);
  });

  it("maps the blue ripple across multiple radial light phases", () => {
    const plan = compileFireworkDesign(
      ensureFireworkDesignV4(BLUE_RIPPLE_PRESET),
      SUMMER_CHECK_SEED,
    );
    expect(new Set(plan.stars.map((star) => star.definition.id))).toEqual(
      new Set(["star-relay-light", "star-kouro"]),
    );
    expect(
      new Set(plan.stars.map((star) => star.effectPhase)).size,
    ).toBeGreaterThanOrEqual(5);
  });

  it("keeps the summer shower's popping droplets bounded", () => {
    const plan = compileFireworkDesign(
      SUMMER_SHOWER_WILLOW_PRESET,
      SUMMER_CHECK_SEED,
    );
    expect(new Set(plan.stars.map((star) => star.layerID))).toEqual(
      new Set(["layer-outer", "layer-silver-rain", "layer-rain-splashes"]),
    );
    expect(plan.estimatedCost.secondaryParticleCount).toBe(220);
    expect(plan.estimatedCost.maximumParticles).toBe(452);
  });
});
