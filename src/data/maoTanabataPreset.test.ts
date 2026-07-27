import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import { isFireworkDesignV2 } from "./firework";
import { ensureFireworkDesignV4 } from "./migrations/v3ToV4";
import {
  FIREWORK_PRESETS,
  MAO_TANABATA_AFTERGLOW_PRESET,
  MAO_TANABATA_EDGE_PRESET,
  MAO_TANABATA_PRESET,
} from "./presets";

const CHECK_SEED = 7_070_707;
const PORTRAIT_POINT_COUNT = 1_257;
const FRAME_POINT_COUNT = 96;
const EDGE_POINT_COUNT = 548;

describe("Mao Tanabata static mosaic preset", () => {
  it("registers a valid built-in shell without runtime image stars", () => {
    expect(isFireworkDesignV2(MAO_TANABATA_PRESET)).toBe(true);
    expect(FIREWORK_PRESETS).toContain(MAO_TANABATA_PRESET);
    expect(MAO_TANABATA_PRESET.id).toBe("preset-mao-tanabata");
    expect(
      Object.keys(MAO_TANABATA_PRESET.starDefinitions).some((id) =>
        id.startsWith("star-image-"),
      ),
    ).toBe(false);
    expect(
      MAO_TANABATA_PRESET.layers.every(
        (layer) => layer.kind === "pattern" && layer.template === "custom",
      ),
    ).toBe(true);
  });

  it("compiles the fixed portrait and frame deterministically", () => {
    const first = compileFireworkDesign(MAO_TANABATA_PRESET, CHECK_SEED);
    const second = compileFireworkDesign(MAO_TANABATA_PRESET, CHECK_SEED);

    expect(second).toEqual(first);
    expect(first.stars).toHaveLength(PORTRAIT_POINT_COUNT + FRAME_POINT_COUNT);
    expect(
      first.stars.filter(
        ({ layerID }) => layerID === "layer-mao-tanabata-portrait",
      ),
    ).toHaveLength(PORTRAIT_POINT_COUNT);
    expect(
      first.stars.filter(
        ({ layerID }) => layerID === "layer-mao-tanabata-frame",
      ),
    ).toHaveLength(FRAME_POINT_COUNT);
    expect(first.estimatedCost.maximumParticles).toBe(1_353);
    expect(first.warnings).toEqual([]);
  });

  it("keeps the same static points after migration to editable v4 intent", () => {
    const editable = ensureFireworkDesignV4(MAO_TANABATA_PRESET);
    const first = compileFireworkDesign(editable, CHECK_SEED);
    const second = compileFireworkDesign(editable, CHECK_SEED);

    expect(second).toEqual(first);
    expect(first.stars).toHaveLength(PORTRAIT_POINT_COUNT + FRAME_POINT_COUNT);
    expect(
      new Set(
        first.stars
          .map(({ definition }) => definition.id)
          .filter((id) => id.startsWith("star-mao-tanabata-")),
      ).size,
    ).toBe(16);
    expect(
      first.stars.every(({ initialVelocity }) =>
        Object.values(initialVelocity).every(Number.isFinite),
      ),
    ).toBe(true);
  });

  it("offers a separate softly fading version with a lingering light ring", () => {
    expect(FIREWORK_PRESETS).toContain(MAO_TANABATA_AFTERGLOW_PRESET);
    expect(MAO_TANABATA_AFTERGLOW_PRESET.id).not.toBe(MAO_TANABATA_PRESET.id);
    expect(MAO_TANABATA_AFTERGLOW_PRESET.name).toBe("七夕のまお・淡光");

    const plan = compileFireworkDesign(
      MAO_TANABATA_AFTERGLOW_PRESET,
      CHECK_SEED,
    );
    const portrait = plan.stars.filter(
      ({ layerID }) => layerID === "layer-mao-tanabata-afterglow-portrait",
    );
    const afterglow = plan.stars.filter(
      ({ layerID }) => layerID === "layer-mao-tanabata-afterglow-frame",
    );

    expect(portrait).toHaveLength(PORTRAIT_POINT_COUNT);
    expect(afterglow).toHaveLength(FRAME_POINT_COUNT);
    expect(
      portrait.every(
        ({ definition }) =>
          definition.burnDuration === 4.45 &&
          definition.colorStages.length === 5 &&
          definition.trailLifetime === 0.18,
      ),
    ).toBe(true);
    expect(
      afterglow.every(
        ({ definition }) =>
          definition.burnDuration === 5.8 &&
          definition.effectProfile?.light?.terminal?.mode === "kouro",
      ),
    ).toBe(true);
    expect(plan.estimatedCost.maximumParticles).toBe(1_449);
    expect(plan.estimatedCost.terminalSparkCount).toBe(FRAME_POINT_COUNT);
    expect(plan.estimatedCost.trailCount).toBe(FRAME_POINT_COUNT);
    expect(plan.warnings).toEqual([]);
  });

  it("offers a sparse edge-only version without filling the portrait", () => {
    expect(FIREWORK_PRESETS).toContain(MAO_TANABATA_EDGE_PRESET);
    expect(MAO_TANABATA_EDGE_PRESET.name).toBe("七夕のまお・光輪郭");

    const first = compileFireworkDesign(MAO_TANABATA_EDGE_PRESET, CHECK_SEED);
    const second = compileFireworkDesign(MAO_TANABATA_EDGE_PRESET, CHECK_SEED);
    const portrait = first.stars.filter(
      ({ layerID }) => layerID === "layer-mao-tanabata-edge-portrait",
    );
    const frame = first.stars.filter(
      ({ layerID }) => layerID === "layer-mao-tanabata-edge-frame",
    );

    expect(second).toEqual(first);
    expect(portrait).toHaveLength(EDGE_POINT_COUNT);
    expect(portrait.length).toBeLessThan(PORTRAIT_POINT_COUNT / 2);
    expect(frame).toHaveLength(FRAME_POINT_COUNT);
    expect(first.estimatedCost.maximumParticles).toBe(
      EDGE_POINT_COUNT + FRAME_POINT_COUNT,
    );
    expect(first.estimatedCost.trailCount).toBe(0);
    expect(first.warnings).toEqual([]);

    const edgeLayer = MAO_TANABATA_EDGE_PRESET.layers.find(
      ({ id }) => id === "layer-mao-tanabata-edge-portrait",
    );
    expect(edgeLayer?.kind).toBe("pattern");
    if (edgeLayer?.kind !== "pattern") {
      throw new Error("Expected the edge portrait to remain a pattern layer.");
    }
    const bangStroke = edgeLayer.points.filter(
      ({ groupId, x, y }) =>
        groupId === "3" && Math.abs(x - 0.123) < 0.001 && y > 0.44 && y < 0.5,
    );
    expect(bangStroke).toHaveLength(2);

    const editable = ensureFireworkDesignV4(MAO_TANABATA_EDGE_PRESET);
    expect(compileFireworkDesign(editable, CHECK_SEED).stars).toHaveLength(
      EDGE_POINT_COUNT + FRAME_POINT_COUNT,
    );
  });
});
