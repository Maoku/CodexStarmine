import { describe, expect, it } from "vitest";

import type { SubjectMask } from "./GuidedImagePlacementTypes";
import {
  boundaryF1,
  evaluateSegmentation,
  normalizedBoundaryDistance,
} from "./segmentationMetrics";

function rectangle(
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): SubjectMask {
  const data = new Uint8Array(width * height);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) data[y * width + x] = 255;
  }
  return { data, height, width };
}

describe("segmentationMetrics", () => {
  it("returns perfect metrics for identical masks", () => {
    const mask = rectangle(16, 12, 3, 2, 11, 9);
    expect(evaluateSegmentation(mask, mask)).toEqual({
      boundaryF1: 1,
      maskIoU: 1,
      normalizedBoundaryDistance: 0,
      promptViolationCount: 0,
    });
  });

  it("allows a configured one-pixel boundary tolerance", () => {
    const truth = rectangle(16, 12, 3, 2, 10, 9);
    const shifted = rectangle(16, 12, 4, 2, 11, 9);
    expect(boundaryF1(shifted, truth, 1)).toBeGreaterThan(
      boundaryF1(shifted, truth, 0),
    );
    expect(normalizedBoundaryDistance(shifted, truth)).toBeGreaterThan(0);
  });

  it("reports prompt violations together with quality", () => {
    const prediction = rectangle(10, 10, 2, 2, 7, 7);
    const metrics = evaluateSegmentation(prediction, prediction, [
      { id: "wrong-subject", kind: "subject", point: { x: 0.05, y: 0.05 } },
      {
        id: "wrong-background",
        kind: "background",
        point: { x: 0.5, y: 0.5 },
      },
    ]);
    expect(metrics.promptViolationCount).toBe(2);
  });
});
