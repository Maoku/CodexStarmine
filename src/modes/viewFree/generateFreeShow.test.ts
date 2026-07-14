import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET, PEONY_PRESET } from "../../data";
import { generateFreeShow } from "./generateFreeShow";

describe("generateFreeShow", () => {
  it("uses the same FireworkDesign IDs across a ShowCue timeline", () => {
    const plan = generateFreeShow(
      [CHRYSANTHEMUM_PRESET, PEONY_PRESET],
      1,
      2026,
    );
    expect(plan.cues.length).toBeGreaterThan(8);
    expect(
      plan.cues.every((cue) =>
        [CHRYSANTHEMUM_PRESET.id, PEONY_PRESET.id].includes(
          cue.fireworkDesignID,
        ),
      ),
    ).toBe(true);
  });

  it("guarantees a saved custom design appears in the show", () => {
    const custom = { ...PEONY_PRESET, id: "custom-lakeside", name: "湖の牡丹" };
    const plan = generateFreeShow([CHRYSANTHEMUM_PRESET, custom], 1, 7);
    expect(plan.cues.some((cue) => cue.fireworkDesignID === custom.id)).toBe(
      true,
    );
  });

  it("keeps an explicit quiet interval for smoke and afterglow", () => {
    const plan = generateFreeShow([CHRYSANTHEMUM_PRESET], 2, 8);
    const gaps = plan.cues
      .slice(1)
      .map((cue, index) => cue.time - plan.cues[index].time);
    expect(Math.max(...gaps)).toBeGreaterThan(3.5);
  });

  it("adds cues as density increases", () => {
    const designs = [CHRYSANTHEMUM_PRESET, PEONY_PRESET];
    expect(generateFreeShow(designs, 2, 3).cues.length).toBeGreaterThan(
      generateFreeShow(designs, 0, 3).cues.length,
    );
  });
});
