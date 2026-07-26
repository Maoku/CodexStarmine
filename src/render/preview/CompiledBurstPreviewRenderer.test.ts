import { describe, expect, it, vi } from "vitest";

import { RENEWAL3_CHECK_SEED } from "../../app/renewal3Contracts";
import { createCompiledStarParticle } from "../../core/burst";
import {
  advanceBurstParticle,
  BURST_PARTICLE_ENVIRONMENT,
} from "../../core/particle";
import {
  CHRYSANTHEMUM_PRESET,
  ensureFireworkDesignV4,
  PEONY_PRESET,
  POPPING_SHOWER_PRESET,
} from "../../data";
import { SingleLoopCheckController } from "../../modes/check";
import {
  buildCompiledBurstPreviewModel,
  MAX_PREVIEW_STARS,
  renderCompiledBurstPreview,
} from "./CompiledBurstPreviewRenderer";

describe("CompiledBurstPreviewRenderer", () => {
  it("compiles current authored intent and renders production trajectories", () => {
    const intent = ensureFireworkDesignV4(CHRYSANTHEMUM_PRESET);
    const first = buildCompiledBurstPreviewModel(intent);
    const second = buildCompiledBurstPreviewModel(intent);
    const html = renderCompiledBurstPreview(first, true, 0);

    expect(second).toEqual(first);
    expect(first.sampledStars.length).toBeGreaterThan(0);
    expect(first.sampledStars[0].trajectory.length).toBeGreaterThan(2);
    expect(html).toContain("compiled-preview-star");
    expect(html).toContain("<animate");
    expect(html).toContain("打上結果プレビュー");
    expect(html).not.toContain("抽象表示");
  });

  it("retains every layer while bounding deterministic preview sampling", () => {
    const design = structuredClone(CHRYSANTHEMUM_PRESET);
    const spherical = design.layers.find((layer) => layer.kind === "spherical");
    if (!spherical || spherical.kind !== "spherical") {
      throw new Error("Spherical layer fixture is missing.");
    }
    spherical.count = 1_200;
    const model = buildCompiledBurstPreviewModel(design);
    const planLayerIDs = new Set([
      ...model.plan.stars.map((star) => star.layerID),
      ...model.plan.childBursts.flatMap((child) =>
        child.stars.map((star) => star.layerID),
      ),
    ]);

    expect(model.sampledStars).toHaveLength(MAX_PREVIEW_STARS);
    expect(new Set(model.sampledStars.map((star) => star.layerID))).toEqual(
      planLayerIDs,
    );
    expect(renderCompiledBurstPreview(model, false, 3)).not.toContain(
      "<animate",
    );
  });

  it("uses the same fixed-seed plan and motion step as check playback", () => {
    const intent = ensureFireworkDesignV4(PEONY_PRESET);
    const model = buildCompiledBurstPreviewModel(intent, RENEWAL3_CHECK_SEED);
    const onLaunch = vi.fn();
    const controller = new SingleLoopCheckController({
      onLaunch,
      onState: vi.fn(),
    });
    controller.start(intent);
    controller.update(0);

    const [, seed, checkPlan] = onLaunch.mock.calls[0];
    expect(seed).toBe(RENEWAL3_CHECK_SEED);
    expect(checkPlan).toEqual(model.plan);

    const representative = model.sampledStars.find(
      (star) => star.sourceIndex < checkPlan.stars.length,
    );
    if (!representative) throw new Error("Representative star is missing.");
    const trajectoryPoint = representative.trajectory[1];
    const particle = createCompiledStarParticle(
      checkPlan.stars[representative.sourceIndex],
      intent,
    );
    let elapsed = 0;
    while (elapsed + 0.000_001 < trajectoryPoint.time) {
      const delta = Math.min(trajectoryPoint.time - elapsed, 0.05);
      advanceBurstParticle(particle, delta, BURST_PARTICLE_ENVIRONMENT);
      elapsed += delta;
    }
    expect(particle.position).toEqual({
      x: trajectoryPoint.x,
      y: trajectoryPoint.y,
      z: trajectoryPoint.z,
    });
  });

  it("raises temporal sampling only for high-frequency strobe effects", () => {
    const intent = ensureFireworkDesignV4(CHRYSANTHEMUM_PRESET);
    const layer = intent.layers[0]!;
    intent.starDefinitions[layer.defaultStarId].effectProfile = {
      light: {
        dutyCycle: 0.3,
        edgeSoftness: 0,
        frequencyHz: 12,
        mode: "strobe",
      },
    };
    const model = buildCompiledBurstPreviewModel(intent);
    const trajectory = model.sampledStars[0].trajectory;
    expect(trajectory).toHaveLength(48);
    expect(trajectory.some((point) => point.lightMultiplier === 0)).toBe(true);
    expect(trajectory.some((point) => point.lightMultiplier > 0)).toBe(true);
  });

  it("shows a bounded point expansion for compiled micro-bursts", () => {
    const model = buildCompiledBurstPreviewModel(POPPING_SHOWER_PRESET);
    expect(
      model.sampledStars.some((star) =>
        star.trajectory.some((point) => point.secondaryScale > 0),
      ),
    ).toBe(true);
    expect(renderCompiledBurstPreview(model, true, 0)).toContain(
      'attributeName="r"',
    );
  });
});
