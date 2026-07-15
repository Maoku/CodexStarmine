import { describe, expect, it } from "vitest";

import { PEONY_PRESET } from "../../data";
import { deriveLaunchKinematics } from "./FireworkSystem";

describe("deriveLaunchKinematics", () => {
  it("keeps check launches deterministic when the seed is fixed", () => {
    const first = deriveLaunchKinematics(PEONY_PRESET, {
      lane: 0,
      seed: 50_226,
    });
    const second = deriveLaunchKinematics(PEONY_PRESET, {
      lane: 0,
      seed: 50_226,
    });

    expect(second).toEqual(first);
  });

  it("uses the supplied target height without adding launch variation", () => {
    const launch = deriveLaunchKinematics(PEONY_PRESET, {
      seed: 50_226,
      targetHeight: 128,
    });

    expect(launch.targetHeight).toBe(128);
  });
});
