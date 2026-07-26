import { describe, expect, it } from "vitest";

import { BUILTIN_STAR_PRESETS, type VirtualStarPreset } from "../../data";
import {
  buildStarBehaviorPreviewScenario,
  evaluatePreviewParticlePosition,
} from "./buildStarBehaviorPreviewScenario";

describe("buildStarBehaviorPreviewScenario", () => {
  it("builds fixed bounded scenarios for every Phase 2 virtual star", () => {
    const stars = BUILTIN_STAR_PRESETS.filter((star) =>
      [
        "star-strobe-white-hard",
        "star-strobe-pastel",
        "star-kouro",
        "star-teka",
        "star-repeat-change",
      ].includes(star.id),
    );
    expect(stars).toHaveLength(5);
    stars.forEach((star) => {
      const first = buildStarBehaviorPreviewScenario(star);
      expect(buildStarBehaviorPreviewScenario(star)).toEqual(first);
      expect(first.layout).toBe("sphere");
      expect(first.particles).toHaveLength(28);
      expect(first.duration).toBeGreaterThanOrEqual(1.8);
      expect(first.duration).toBeLessThanOrEqual(5.8);
    });
  });

  it("selects fan and sparse-sphere layouts from orthogonal effects", () => {
    const source = structuredClone(BUILTIN_STAR_PRESETS[0]);
    const fallingLeaf: VirtualStarPreset = {
      ...source,
      id: "test-leaf",
      effectProfile: {
        motion: { amplitude: 0.5, mode: "fallingLeaf" },
      },
    };
    const popping: VirtualStarPreset = {
      ...source,
      id: "test-popping",
      effectProfile: {
        secondary: { count: 4, mode: "microBurst" },
      },
    };
    expect(buildStarBehaviorPreviewScenario(fallingLeaf)).toMatchObject({
      layout: "fan",
      particles: expect.any(Array),
    });
    expect(
      buildStarBehaviorPreviewScenario(fallingLeaf).particles,
    ).toHaveLength(18);
    expect(buildStarBehaviorPreviewScenario(popping)).toMatchObject({
      layout: "sparse-sphere",
      particles: expect.any(Array),
    });
    expect(buildStarBehaviorPreviewScenario(popping).particles).toHaveLength(
      12,
    );
  });

  it("uses a phased ring for relay and gradient stars", () => {
    for (const id of ["star-relay-light", "star-gradient-fade"]) {
      const star = BUILTIN_STAR_PRESETS.find(
        (candidate) => candidate.id === id,
      );
      if (!star) throw new Error(`missing ${id}`);
      const scenario = buildStarBehaviorPreviewScenario(star);
      expect(scenario.layout).toBe("ring");
      expect(scenario.particles).toHaveLength(32);
      expect(scenario.particles.map(({ effectPhase }) => effectPhase)).toEqual(
        Array.from({ length: 32 }, (_, index) => index / 32),
      );
    }
  });

  it("evaluates preview ballistics and motion from absolute age", () => {
    const star = structuredClone(BUILTIN_STAR_PRESETS[0]);
    const scenario = buildStarBehaviorPreviewScenario(star, 42);
    const particle = scenario.particles[0];
    expect(evaluatePreviewParticlePosition(particle, star, 0)).toEqual(
      particle.initialPosition,
    );
    expect(evaluatePreviewParticlePosition(particle, star, 1.25)).toEqual(
      evaluatePreviewParticlePosition(particle, star, 1.25),
    );
  });
});
