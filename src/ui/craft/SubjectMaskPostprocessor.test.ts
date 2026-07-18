import { describe, expect, it } from "vitest";

import type { ProbabilityMask } from "./GuidedImagePlacementTypes";
import { postprocessProbabilityMask } from "./SubjectMaskPostprocessor";

function probability(
  width: number,
  height: number,
  value: (x: number, y: number) => number,
): ProbabilityMask {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = value(x, y);
  }
  return { data, height, width };
}

describe("SubjectMaskPostprocessor", () => {
  it("keeps every subject-seeded component and removes weak noise", () => {
    const result = postprocessProbabilityMask(
      probability(30, 20, (x, y) => {
        if (x >= 2 && x <= 8 && y >= 4 && y <= 15) return 0.9;
        if (x >= 20 && x <= 27 && y >= 4 && y <= 15) return 0.9;
        if (x === 14 && y === 2) return 0.6;
        return 0.05;
      }),
      [
        { id: "left", kind: "subject", point: { x: 0.15, y: 0.5 } },
        { id: "right", kind: "subject", point: { x: 0.8, y: 0.5 } },
      ],
      { threshold: 0.5 },
    );

    expect(result.mask.data[10 * 30 + 5]).toBe(255);
    expect(result.mask.data[10 * 30 + 24]).toBe(255);
    expect(result.mask.data[2 * 30 + 14]).toBe(0);
    expect(result.constraintsSatisfied).toBe(true);
  });

  it("preserves a negative-point hole and high-confidence thin detail", () => {
    const result = postprocessProbabilityMask(
      probability(24, 24, (x, y) => {
        if (x >= 4 && x <= 19 && y >= 4 && y <= 19) return 0.92;
        if (x === 12 && y <= 4) return 0.97;
        return 0.03;
      }),
      [
        { id: "subject", kind: "subject", point: { x: 0.4, y: 0.5 } },
        {
          id: "background",
          kind: "background",
          point: { x: 0.65, y: 0.5 },
        },
      ],
      { threshold: 0.5 },
    );

    expect(result.mask.data[12 * 24 + 10]).toBe(255);
    expect(result.mask.data[12 * 24 + 15]).toBe(0);
    expect(result.mask.data[2 * 24 + 12]).toBe(255);
    expect(result.constraintRepairApplied).toBe(true);
    expect(result.promptViolationCount).toBe(0);
  });

  it("reports irreconcilable prompts at the same coordinate", () => {
    const result = postprocessProbabilityMask(
      probability(12, 12, () => 0.1),
      [
        { id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } },
        { id: "background", kind: "background", point: { x: 0.5, y: 0.5 } },
      ],
      { threshold: 0.5 },
    );

    expect(result.constraintsSatisfied).toBe(false);
    expect(result.promptViolationCount).toBeGreaterThan(0);
  });
});
