import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import {
  BEE_PRESET,
  CHRYSANTHEMUM_PRESET,
  CROWN_PRESET,
  FIREWORK_PRESETS,
  HANARAI_PRESET,
  PEONY_PRESET,
  SENRIN_PRESET,
} from "../data";
import { deriveFireworkSoundCharacter } from "./FireworkSoundCharacter";

function character(design: (typeof FIREWORK_PRESETS)[number], seed = 42_091) {
  return deriveFireworkSoundCharacter(
    design,
    compileFireworkDesign(design, seed),
  );
}

describe("firework sound characters", () => {
  it("gives crowns a deeper, longer report than peonies", () => {
    const crown = character(CROWN_PRESET);
    const peony = character(PEONY_PRESET);

    expect(crown.style).toBe("heavy");
    expect(crown.bodyDurationScale).toBeGreaterThan(peony.bodyDurationScale);
    expect(crown.lowEndScale).toBeGreaterThan(peony.lowEndScale);
    expect(crown.reverbScale).toBeGreaterThan(peony.reverbScale);
  });

  it("gives flower thunder a sharp report and timed secondary cracks", () => {
    const thunder = character(HANARAI_PRESET);
    const classic = character(CHRYSANTHEMUM_PRESET);

    expect(thunder.style).toBe("thunder");
    expect(thunder.reportScale).toBeGreaterThan(classic.reportScale);
    expect(thunder.crackleScale).toBeGreaterThan(classic.crackleScale);
    expect(thunder.starMix.crackle).toBeGreaterThan(0.9);
    expect(thunder.secondaryReports.length).toBeGreaterThan(1);
    expect(thunder.secondaryReports.length).toBeLessThanOrEqual(12);
    expect(
      thunder.secondaryReports.every(
        (report, index, reports) =>
          index === 0 || report.delay >= reports[index - 1].delay,
      ),
    ).toBe(true);
  });

  it("turns bee shells into moving stereo voices", () => {
    const bee = character(BEE_PRESET);

    expect(bee.style).toBe("spinner");
    expect(bee.movingVoices.length).toBe(5);
    expect(
      bee.movingVoices.every(
        (voice) => voice.startPanOffset !== voice.endPanOffset,
      ),
    ).toBe(true);
  });

  it("uses compiled child bursts for thousand-ring secondary reports", () => {
    const thousandRings = character(SENRIN_PRESET);

    expect(thousandRings.style).toBe("cluster");
    expect(thousandRings.secondaryReports).toHaveLength(12);
    expect(
      new Set(
        thousandRings.secondaryReports.map((report) =>
          report.panOffset.toFixed(3),
        ),
      ).size,
    ).toBeGreaterThan(4);
  });

  it("follows virtual-star sound tags when a work is edited", () => {
    const softDesign = structuredClone(PEONY_PRESET);
    const deepDesign = structuredClone(PEONY_PRESET);
    const crackleDesign = structuredClone(PEONY_PRESET);

    for (const layer of deepDesign.layers) {
      deepDesign.starDefinitions[layer.defaultStarId].soundTag = "deep";
    }
    for (const layer of crackleDesign.layers) {
      const star = crackleDesign.starDefinitions[layer.defaultStarId];
      star.emissionKind = "flicker";
      star.soundTag = "crackle";
    }

    const soft = character(softDesign);
    const deep = character(deepDesign);
    const crackle = character(crackleDesign);

    expect(deep.starMix.deep).toBeGreaterThan(0.9);
    expect(deep.lowEndScale).toBeGreaterThan(soft.lowEndScale);
    expect(crackle.starMix.crackle).toBeGreaterThan(0.9);
    expect(crackle.crackleScale).toBeGreaterThan(soft.crackleScale);
    expect(crackle.tailSizzleCount).toBeGreaterThan(soft.tailSizzleCount);
  });

  it("derives finite, bounded schedules for every built-in shell", () => {
    for (const design of FIREWORK_PRESETS) {
      const result = character(design);
      expect(result.bodyDurationScale).toBeGreaterThan(0);
      expect(result.lowEndScale).toBeGreaterThan(0);
      expect(result.reportScale).toBeGreaterThan(0);
      expect(result.tailSizzleCount).toBeGreaterThanOrEqual(0);
      expect(result.tailSizzleCount).toBeLessThanOrEqual(12);
      expect(
        result.secondaryReports.every(
          (report) =>
            Number.isFinite(report.delay) &&
            Number.isFinite(report.panOffset) &&
            report.delay >= 0,
        ),
      ).toBe(true);
    }
  });
});
