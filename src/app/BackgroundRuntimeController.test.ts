import { describe, expect, it, vi } from "vitest";

import { PEONY_PRESET } from "../data";
import { BackgroundRuntimeController } from "./BackgroundRuntimeController";

function createController(log: string[]) {
  return new BackgroundRuntimeController({
    clearScene: () => log.push("clear"),
    startAdvertise: () => log.push("start-advertise"),
    startCheck: () => log.push("start-check"),
    startFree: () => log.push("start-free"),
    stopAdvertise: () => log.push("stop-advertise"),
    stopCheck: () => log.push("stop-check"),
    stopFree: () => log.push("stop-free"),
  });
}

describe("BackgroundRuntimeController", () => {
  it("stops every producer and clears before starting the next runtime", () => {
    const log: string[] = [];
    const controller = createController(log);

    expect(controller.set("advertise")).toBe(true);
    expect(log).toEqual([
      "stop-advertise",
      "stop-check",
      "stop-free",
      "clear",
      "start-advertise",
    ]);

    log.length = 0;
    controller.set("free");
    expect(log).toEqual([
      "stop-advertise",
      "stop-check",
      "stop-free",
      "clear",
      "start-free",
    ]);
    expect(controller.runtime).toBe("free");
  });

  it("does not restart an already active runtime", () => {
    const log: string[] = [];
    const controller = createController(log);
    controller.set("advertise");
    log.length = 0;

    expect(controller.set("advertise")).toBe(false);
    expect(log).toEqual([]);
  });

  it("requires a design before starting the check runtime", () => {
    const log: string[] = [];
    const controller = createController(log);

    expect(() => controller.set("check")).toThrow(/requires a firework design/);
    expect(controller.runtime).toBe("none");
    expect(log).toEqual([]);
    expect(controller.set("check", PEONY_PRESET)).toBe(true);
  });

  it("forwards the selected work to the single-check runtime", () => {
    const startCheck = vi.fn();
    const controller = new BackgroundRuntimeController({
      clearScene: vi.fn(),
      startAdvertise: vi.fn(),
      startCheck,
      startFree: vi.fn(),
      stopAdvertise: vi.fn(),
      stopCheck: vi.fn(),
      stopFree: vi.fn(),
    });

    controller.set("check", PEONY_PRESET);
    expect(startCheck).toHaveBeenCalledExactlyOnceWith(PEONY_PRESET);
  });
});
