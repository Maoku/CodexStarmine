import { describe, expect, it, vi } from "vitest";

import { FIREWORK_PRESETS } from "../../data";
import { AdvertiseDemoController } from "./AdvertiseDemoController";

describe("AdvertiseDemoController", () => {
  it("emits low-density title cues only while active and visible", () => {
    const onCue = vi.fn();
    const controller = new AdvertiseDemoController({
      getDesigns: () => FIREWORK_PRESETS,
      onCue,
    });

    controller.start();
    controller.update(1);
    expect(onCue).toHaveBeenCalledTimes(1);
    expect(controller.isRunning).toBe(true);

    controller.setPageVisible(false);
    controller.update(30);
    expect(onCue).toHaveBeenCalledTimes(1);
    expect(controller.isRunning).toBe(false);

    controller.setPageVisible(true);
    controller.update(30);
    expect(onCue.mock.calls.length).toBeGreaterThan(1);
    controller.stop();
    const countAfterStop = onCue.mock.calls.length;
    controller.update(30);
    expect(onCue).toHaveBeenCalledTimes(countAfterStop);
  });

  it("uses fewer cues when reduced motion is requested", () => {
    const regularCue = vi.fn();
    const reducedCue = vi.fn();
    const regular = new AdvertiseDemoController({
      getDesigns: () => FIREWORK_PRESETS,
      onCue: regularCue,
    });
    const reduced = new AdvertiseDemoController({
      getDesigns: () => FIREWORK_PRESETS,
      onCue: reducedCue,
    });
    reduced.setReducedMotion(true);

    regular.start();
    reduced.start();
    regular.update(28);
    reduced.update(28);

    expect(reducedCue.mock.calls.length).toBeLessThan(
      regularCue.mock.calls.length,
    );
  });
});
