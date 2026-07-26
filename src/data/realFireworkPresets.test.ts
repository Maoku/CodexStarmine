import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import {
  BEE_PRESET,
  BUTTERFLY_PRESET,
  FIREWORK_PRESETS,
  HANARAI_PRESET,
  HIYUSEI_PRESET,
  ILLUMINATION_PRESET,
  KALEIDOSCOPE_PRESET,
  KOWARI_PRESET,
  KOURO_CHANGE_CHRYSANTHEMUM_PRESET,
  LIGHT_RIPPLE_PRESET,
  ROTATING_LIGHT_RING_PRESET,
  SATURN_PRESET,
  WILLOW_PRESET,
} from "./presets";

const RESEARCHED_PRESETS = [
  WILLOW_PRESET,
  BEE_PRESET,
  HIYUSEI_PRESET,
  HANARAI_PRESET,
  KALEIDOSCOPE_PRESET,
  SATURN_PRESET,
  BUTTERFLY_PRESET,
  KOWARI_PRESET,
];

const PHASE_3_PRESETS = [
  ILLUMINATION_PRESET,
  ROTATING_LIGHT_RING_PRESET,
  LIGHT_RIPPLE_PRESET,
  KOURO_CHANGE_CHRYSANTHEMUM_PRESET,
];

describe("researched real-firework presets", () => {
  it("adds eight uniquely identified designs to the six original samples", () => {
    const existing = FIREWORK_PRESETS.slice(0, 14);
    expect(existing).toHaveLength(14);
    expect(new Set(existing.map((preset) => preset.id)).size).toBe(14);
    expect(new Set(existing.map((preset) => preset.pattern)).size).toBe(14);
    expect(existing.slice(-8)).toEqual(RESEARCHED_PRESETS);
    RESEARCHED_PRESETS.forEach((preset) => {
      expect(preset.id).toMatch(/^preset-/);
      expect(preset.description.length).toBeGreaterThan(20);
    });
  });

  it("adds four Phase 3 works with stable spatial phase mappings", () => {
    expect(FIREWORK_PRESETS).toHaveLength(18);
    expect(new Set(FIREWORK_PRESETS.map((preset) => preset.id)).size).toBe(18);
    expect(FIREWORK_PRESETS.slice(-4)).toEqual(PHASE_3_PRESETS);
    expect(outerLayer(ILLUMINATION_PRESET).effectTiming?.mapping).toBe(
      "random",
    );
    expect(outerLayer(ROTATING_LIGHT_RING_PRESET).effectTiming?.mapping).toBe(
      "longitude",
    );
    expect(outerLayer(LIGHT_RIPPLE_PRESET).effectTiming?.mapping).toBe(
      "radius",
    );
    PHASE_3_PRESETS.forEach((preset) => {
      const first = compileFireworkDesign(preset, 7_019);
      const second = compileFireworkDesign(preset, 7_019);
      expect(second.stars.map(({ effectPhase }) => effectPhase)).toEqual(
        first.stars.map(({ effectPhase }) => effectPhase),
      );
      expect(
        first.stars.some(({ effectPhase }) => effectPhase !== undefined),
      ).toBe(true);
    });
  });

  it("models willow, bees, and flying stars with distinct trails", () => {
    expect(outerDefinition(WILLOW_PRESET)).toMatchObject({
      emissionKind: "goldTail",
      gravityScale: 1.92,
      trailLifetime: 1,
    });
    expect(BEE_PRESET.layers.some((layer) => layer.kind === "branch")).toBe(
      true,
    );
    expect(
      HIYUSEI_PRESET.layers.filter((layer) => layer.kind === "branch"),
    ).toHaveLength(2);
  });

  it("gives flower thunder and kaleidoscope timed secondary bursts", () => {
    const thunder = compileFireworkDesign(HANARAI_PRESET, 7_019);
    const kaleidoscope = compileFireworkDesign(KALEIDOSCOPE_PRESET, 7_019);
    expect(thunder.childBursts).toHaveLength(8);
    expect(
      thunder.stars.every((star) => star.definition.soundTag === "crackle"),
    ).toBe(true);
    expect(kaleidoscope.childBursts).toHaveLength(18);
    expect(
      new Set(
        kaleidoscope.childBursts.map((burst) => burst.stars[0]?.definition.id),
      ).size,
    ).toBe(3);
  });

  it("keeps the Saturn ring flatter than its planetary core", () => {
    const plan = compileFireworkDesign(SATURN_PRESET, 8_026);
    const ring = plan.stars.filter((star) => star.layerID === "layer-pattern");
    const width = Math.max(
      ...ring.map((star) => Math.abs(star.initialVelocity.x)),
    );
    const height = Math.max(
      ...ring.map((star) => Math.abs(star.initialVelocity.y)),
    );
    expect(width).toBeGreaterThan(height * 2.8);
    expect(plan.stars.some((star) => star.layerID === "layer-core-1")).toBe(
      true,
    );
  });

  it("draws a grouped butterfly and seven larger kowari blooms", () => {
    const butterfly = BUTTERFLY_PRESET.layers.find(
      (layer) => layer.kind === "pattern",
    );
    expect(butterfly?.kind).toBe("pattern");
    if (butterfly?.kind !== "pattern") throw new Error("expected pattern");
    expect(butterfly.groups.map((group) => group.id)).toEqual([
      "left-wing",
      "right-wing",
      "body",
    ]);
    expect(
      compileFireworkDesign(KOWARI_PRESET, 7_019).childBursts,
    ).toHaveLength(7);
  });
});

function outerDefinition(preset: (typeof RESEARCHED_PRESETS)[number]) {
  return preset.starDefinitions[`${preset.id}-outer-star`];
}

function outerLayer(preset: (typeof PHASE_3_PRESETS)[number]) {
  const layer = preset.layers.find(
    (candidate) => candidate.kind === "spherical",
  );
  if (!layer || layer.kind !== "spherical") {
    throw new Error("expected spherical layer");
  }
  return layer;
}
