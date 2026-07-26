import { describe, expect, it } from "vitest";

import type { ColorStage, VirtualStarEffectProfile } from "../../data";
import {
  evaluateColorStages,
  evaluateDeterministicFlicker,
  evaluateLightEnvelope,
  evaluateMotionOffset,
  evaluateSecondaryEvent,
  evaluateVirtualStarAppearance,
} from "./starEffects";

const STAGES: ColorStage[] = [
  {
    color: 0xff0000,
    intensity: 1,
    normalizedTime: 0,
    trailColor: 0x880000,
  },
  {
    color: 0x00ff00,
    intensity: 0.8,
    normalizedTime: 0.5,
    trailColor: 0x008800,
  },
  {
    color: 0x0000ff,
    intensity: 0,
    normalizedTime: 1,
    trailColor: 0x000088,
  },
];

describe("virtual star effect evaluation", () => {
  it("switches step colors without interpolating across boundaries", () => {
    const profile: VirtualStarEffectProfile = {
      color: { mode: "step", playback: "once" },
    };
    expect(evaluateColorStages(STAGES, 0.499, profile).color).toBe(0xff0000);
    expect(evaluateColorStages(STAGES, 0.5, profile).color).toBe(0x00ff00);
    expect(evaluateColorStages(STAGES, 0.999, profile).color).toBe(0x00ff00);
    expect(evaluateColorStages(STAGES, 1, profile).color).toBe(0x0000ff);
  });

  it("supports deterministic loop and ping-pong color playback", () => {
    const loop: VirtualStarEffectProfile = {
      color: { mode: "step", playback: "loop", repeatCount: 2 },
    };
    const pingPong: VirtualStarEffectProfile = {
      color: { mode: "step", playback: "pingPong", repeatCount: 1 },
    };
    expect(evaluateColorStages(STAGES, 0.3, loop).color).toBe(0x00ff00);
    expect(evaluateColorStages(STAGES, 0.55, loop).color).toBe(0xff0000);
    expect(evaluateColorStages(STAGES, 0.25, pingPong).color).toBe(0xff0000);
    expect(evaluateColorStages(STAGES, 0.75, pingPong).color).toBe(0x00ff00);
  });

  it("offsets looping color playback by the authored effect phase", () => {
    const profile: VirtualStarEffectProfile = {
      color: { mode: "step", playback: "loop", repeatCount: 1 },
    };
    const first = evaluateVirtualStarAppearance({
      ageSeconds: 0.1,
      colorStages: STAGES,
      effectPhase: 0,
      effectProfile: profile,
      lifetimeSeconds: 2,
    });
    const shifted = evaluateVirtualStarAppearance({
      ageSeconds: 0.1,
      colorStages: STAGES,
      effectPhase: 0.55,
      effectProfile: profile,
      lifetimeSeconds: 2,
    });
    expect(first.color).toBe(0xff0000);
    expect(shifted.color).toBe(0x00ff00);
  });

  it("evaluates strobe frequency, duty cycle, and phase from absolute time", () => {
    const profile: VirtualStarEffectProfile = {
      light: {
        dutyCycle: 0.25,
        edgeSoftness: 0,
        frequencyHz: 2,
        mode: "strobe",
      },
    };
    expect(evaluateLightEnvelope(profile, 0.1, 0, 1, 0.1)).toBe(1);
    expect(evaluateLightEnvelope(profile, 0.2, 0, 1, 0.2)).toBe(0);
    expect(evaluateLightEnvelope(profile, 0.1, 0.5, 1, 0.1)).toBe(0);
  });

  it("distinguishes kouro afterglow from a stronger teka terminal flash", () => {
    const terminalProfile = (
      mode: "kouro" | "teka",
    ): VirtualStarEffectProfile => ({
      light: {
        mode: "continuous",
        terminal: { duration: 0.1, mode, strength: 2 },
      },
    });
    const kouro = evaluateLightEnvelope(
      terminalProfile("kouro"),
      0.95,
      0,
      1,
      1.9,
    );
    const teka = evaluateLightEnvelope(
      terminalProfile("teka"),
      0.95,
      0,
      1,
      1.9,
    );
    expect(kouro).toBeGreaterThan(1);
    expect(teka).toBeGreaterThan(kouro);
    expect(evaluateLightEnvelope(terminalProfile("teka"), 1, 0, 1, 2)).toBe(0);
  });

  it("keeps legacy flicker stable for the same seed and absolute time", () => {
    const first = evaluateDeterministicFlicker(0.86, 1.375, 81_502);
    const second = evaluateDeterministicFlicker(0.86, 1.375, 81_502);
    expect(second).toBe(first);
    expect(evaluateDeterministicFlicker(0.86, 1.375, 81_503)).not.toBe(first);
  });

  it("returns zero ballistic offset and deterministic authored motion", () => {
    expect(
      evaluateMotionOffset({ motion: { mode: "ballistic" } }, 1, 0.2, 9),
    ).toEqual({ x: 0, y: 0, z: 0 });
    const profile: VirtualStarEffectProfile = {
      motion: { amplitude: 0.6, frequencyHz: 1.2, mode: "fallingLeaf" },
    };
    expect(evaluateMotionOffset(profile, 0, 0.2, 9)).toEqual({
      x: 0,
      y: -0,
      z: 0,
    });
    expect(evaluateMotionOffset(profile, 1.25, 0.2, 9)).toEqual(
      evaluateMotionOffset(profile, 1.25, 0.2, 9),
    );
    const wander = evaluateMotionOffset(
      { motion: { amplitude: 0.5, frequencyHz: 1.1, mode: "wander" } },
      1.25,
      0.2,
      9,
    );
    const spiral = evaluateMotionOffset(
      { motion: { amplitude: 0.5, frequencyHz: 1.1, mode: "spiral" } },
      1.25,
      0.2,
      9,
    );
    expect(wander).not.toEqual({ x: 0, y: 0, z: 0 });
    expect(spiral).not.toEqual(wander);
    expect(
      evaluateMotionOffset(
        { motion: { amplitude: 0.5, frequencyHz: 1.1, mode: "spiral" } },
        1.25,
        0.2,
        9,
      ),
    ).toEqual(spiral);
  });

  it("emits one deterministic secondary event only when crossing its boundary", () => {
    const profile: VirtualStarEffectProfile = {
      secondary: {
        count: 4,
        mode: "microBurst",
        speedScale: 0.7,
        triggerTime: 0.8,
      },
    };
    expect(evaluateSecondaryEvent(profile, 0.7, 0.79, 42)).toBeUndefined();
    const event = evaluateSecondaryEvent(profile, 0.79, 0.95, 42);
    expect(event).toMatchObject({
      mode: "microBurst",
      particles: expect.any(Array),
      triggerTime: 0.8,
    });
    expect(event?.particles).toHaveLength(4);
    expect(evaluateSecondaryEvent(profile, 0.8, 0.95, 42)).toBeUndefined();
    expect(evaluateSecondaryEvent(profile, 0.79, 0.95, 42)).toEqual(event);
  });

  it("produces the same appearance at the same absolute time for any frame step", () => {
    const profile: VirtualStarEffectProfile = {
      color: { mode: "step", playback: "pingPong", repeatCount: 3 },
      light: {
        dutyCycle: 0.42,
        edgeSoftness: 0.04,
        frequencyHz: 7,
        mode: "strobe",
      },
      motion: { amplitude: 0.3, frequencyHz: 1.4, mode: "wander" },
    };
    const sample = (step: number) => {
      let age = 0;
      while (age + step < 1.2) age += step;
      age = 1.2;
      return evaluateVirtualStarAppearance({
        ageSeconds: age,
        colorStages: STAGES,
        effectPhase: 0.17,
        effectProfile: profile,
        effectSeed: 731,
        legacyFlicker: 0.4,
        lifetimeSeconds: 2,
      });
    };
    expect(sample(1 / 30)).toEqual(sample(1 / 60));
    expect(sample(0.0173)).toEqual(sample(1 / 60));
  });
});
