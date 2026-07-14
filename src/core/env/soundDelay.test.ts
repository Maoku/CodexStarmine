import { describe, expect, it } from "vitest";

import { calculateSoundDelay } from "./soundDelay";

describe("calculateSoundDelay", () => {
  it("delays a 300 meter burst by about 0.9 seconds", () => {
    expect(calculateSoundDelay(300)).toBeCloseTo(0.875, 3);
  });

  it("can reduce physical delay for performance-first direction", () => {
    expect(calculateSoundDelay(343, 0.25)).toBeCloseTo(0.25, 4);
  });

  it("guards invalid and negative inputs", () => {
    expect(calculateSoundDelay(-100)).toBe(0);
    expect(calculateSoundDelay(Number.NaN)).toBe(0);
  });
});
