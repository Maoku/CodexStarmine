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

  it("guarantees every saved custom design appears in the show", () => {
    const customs = [
      { ...PEONY_PRESET, id: "custom-lakeside", name: "湖の牡丹" },
      { ...PEONY_PRESET, id: "custom-starlight", name: "星明かり" },
      { ...PEONY_PRESET, id: "custom-breeze", name: "夜風" },
    ];
    const plan = generateFreeShow([CHRYSANTHEMUM_PRESET, ...customs], 1, 7);
    const launchedIds = new Set(plan.cues.map((cue) => cue.fireworkDesignID));

    expect(customs.every((custom) => launchedIds.has(custom.id))).toBe(true);
  });

  it("extends the show when the shelf has more works than composition slots", () => {
    const customs = Array.from({ length: 16 }, (_, index) => ({
      ...PEONY_PRESET,
      id: `custom-many-${index}`,
      name: `棚の花火 ${index}`,
    }));
    const plan = generateFreeShow(
      [CHRYSANTHEMUM_PRESET, ...customs],
      0,
      17,
    );
    const launchedIds = new Set(
      plan.cues.map((cue) => cue.fireworkDesignID),
    );

    expect(customs.every((custom) => launchedIds.has(custom.id))).toBe(true);
    expect(plan.duration).toBeGreaterThan(29);
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
