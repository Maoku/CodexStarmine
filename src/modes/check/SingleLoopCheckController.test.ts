import { describe, expect, it, vi } from "vitest";

import { PEONY_PRESET, type FireworkDesign } from "../../data";
import {
  CHECK_LAUNCH_SEED,
  CHECK_LOOP_INTERVAL_SECONDS,
  SingleLoopCheckController,
  type SingleLoopCheckState,
} from "./SingleLoopCheckController";

describe("SingleLoopCheckController", () => {
  it("launches one fixed-seed design per interval", () => {
    const launches: Array<{ design: FireworkDesign; seed: number }> = [];
    const states: SingleLoopCheckState[] = [];
    const controller = new SingleLoopCheckController({
      onLaunch: (design, seed) => launches.push({ design, seed }),
      onState: (state) => states.push(state),
    });

    controller.start(PEONY_PRESET);
    controller.update(0);
    expect(launches).toHaveLength(1);
    expect(launches[0]).toMatchObject({
      design: { id: PEONY_PRESET.id },
      seed: CHECK_LAUNCH_SEED,
    });

    controller.update(CHECK_LOOP_INTERVAL_SECONDS - 0.01);
    expect(launches).toHaveLength(1);
    controller.update(0.01);
    expect(launches).toHaveLength(2);
    expect(launches.map(({ seed }) => seed)).toEqual([
      CHECK_LAUNCH_SEED,
      CHECK_LAUNCH_SEED,
    ]);
    expect(states.at(-1)).toMatchObject({
      active: true,
      loopEnabled: true,
      running: true,
      shotCount: 2,
    });
  });

  it("discards pending launches while paused or stopped", () => {
    const onLaunch = vi.fn();
    const controller = new SingleLoopCheckController({
      intervalSeconds: 2,
      onLaunch,
      onState: vi.fn(),
    });

    controller.start(PEONY_PRESET);
    controller.update(0);
    controller.pause();
    controller.update(10);
    expect(onLaunch).toHaveBeenCalledTimes(1);

    controller.resume();
    controller.update(2);
    expect(onLaunch).toHaveBeenCalledTimes(2);

    controller.stop();
    controller.update(10);
    expect(onLaunch).toHaveBeenCalledTimes(2);
    expect(controller.isActive).toBe(false);
  });

  it("fires only on demand when looping is disabled", () => {
    const onLaunch = vi.fn();
    const controller = new SingleLoopCheckController({
      onLaunch,
      onState: vi.fn(),
    });

    controller.start(PEONY_PRESET);
    controller.setLoopEnabled(false);
    controller.update(0);
    controller.update(30);
    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(controller.isRunning).toBe(false);

    controller.toggle();
    controller.update(0);
    expect(onLaunch).toHaveBeenCalledTimes(2);
    expect(controller.isRunning).toBe(false);
  });
});
