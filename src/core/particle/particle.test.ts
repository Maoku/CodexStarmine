import { describe, expect, it } from "vitest";

import {
  advanceBurstParticle,
  evaluateColorStages,
  integrateParticle,
  mixHexColors,
} from "./particle";

describe("particle color stages", () => {
  const stages = [
    { normalizedTime: 0, color: 0xff0000, intensity: 1, trailColor: 0xffff00 },
    { normalizedTime: 1, color: 0x0000ff, intensity: 0, trailColor: 0x000000 },
  ];

  it("interpolates RGB channels and intensity", () => {
    const result = evaluateColorStages(stages, 0.5);
    expect(result.color).toBe(0x800080);
    expect(result.intensity).toBeCloseTo(0.5);
    expect(result.trailColor).toBe(0x808000);
  });

  it("clamps time to the available stages", () => {
    expect(evaluateColorStages(stages, -1).color).toBe(0xff0000);
    expect(evaluateColorStages(stages, 2).color).toBe(0x0000ff);
  });

  it("mixes colors without overflowing channel bounds", () => {
    expect(mixHexColors(0x000000, 0xffffff, 1.5)).toBe(0xffffff);
  });
});

describe("ballistic integration", () => {
  it("applies drag, gravity and wind", () => {
    const particle = {
      age: 0,
      drag: 0.5,
      gravityScale: 1,
      lifetime: 2,
      position: { x: 0, y: 10, z: 0 },
      velocity: { x: 2, y: 5, z: 0 },
      windResponse: 1,
    };
    integrateParticle(particle, 0.05, {
      gravity: 9.81,
      wind: { x: 2, y: 0, z: -1 },
    });
    expect(particle.position.x).toBeGreaterThan(0);
    expect(particle.position.y).toBeGreaterThan(10);
    expect(particle.velocity.y).toBeLessThan(5);
    expect(particle.velocity.z).toBeLessThan(0);
    expect(particle.age).toBeCloseTo(0.05);
  });

  it("holds position until the ignition delay has elapsed", () => {
    const particle = {
      age: -0.1,
      drag: 0,
      gravityScale: 1,
      lifetime: 2,
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 4, y: 5, z: 6 },
      windResponse: 0,
    };
    expect(
      advanceBurstParticle(particle, 0.05, {
        gravity: 9.81,
        wind: { x: 0, y: 0, z: 0 },
      }),
    ).toBe(false);
    expect(particle.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(particle.age).toBeCloseTo(-0.05);
  });
});
