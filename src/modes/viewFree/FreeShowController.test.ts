import { describe, expect, it } from "vitest";

import { FIREWORK_PRESETS, type ShowCue } from "../../data";
import { FreeShowController, type FreeShowState } from "./FreeShowController";

describe("FreeShowController renewal regression", () => {
  it("starts, pauses, resumes, and emits the existing free-view cues", () => {
    const cues: ShowCue[] = [];
    const states: FreeShowState[] = [];
    const controller = new FreeShowController({
      getDesigns: () => FIREWORK_PRESETS,
      onCue: (cue) => cues.push(cue),
      onState: (state) => states.push(state),
    });

    controller.start();
    expect(controller.isRunning).toBe(true);
    controller.update(0.1);
    expect(cues).toHaveLength(1);

    controller.pause();
    controller.update(10);
    expect(cues).toHaveLength(1);
    expect(states.at(-1)?.running).toBe(false);

    controller.resume();
    controller.update(10);
    expect(controller.isRunning).toBe(true);
    expect(cues.length).toBeGreaterThan(1);
    expect(states.at(-1)?.title.length).toBeGreaterThan(0);

    controller.stop();
    controller.update(30);
    expect(controller.isRunning).toBe(false);
    expect(states.at(-1)?.detail).toBe("演目を終了しました");
  });

  it("reports the shelf work name when its cue launches", () => {
    const custom = {
      ...FIREWORK_PRESETS[0],
      id: "custom-shelf-name",
      name: "棚の星明かり",
    };
    const states: FreeShowState[] = [];
    const controller = new FreeShowController({
      getDesigns: () => [custom],
      onCue: () => undefined,
      onState: (state) => states.push(state),
    });

    controller.start();
    expect(states.at(-1)?.currentFireworkName).toBeUndefined();

    controller.update(0.1);
    expect(states.at(-1)?.currentFireworkName).toBe("棚の星明かり");
  });
});
