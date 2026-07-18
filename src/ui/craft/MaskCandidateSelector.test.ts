import { describe, expect, it } from "vitest";

import type {
  ModelMaskCandidate,
  ProbabilityMask,
  SubjectMask,
} from "./GuidedImagePlacementTypes";
import {
  countPromptViolations,
  maskIoU,
  selectMaskCandidate,
  thresholdProbabilityMask,
} from "./MaskCandidateSelector";

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

function candidate(
  index: number,
  mask: ProbabilityMask,
  predictedIoU: number,
): ModelMaskCandidate {
  return { index, predictedIoU, probabilityMask: mask };
}

describe("MaskCandidateSelector", () => {
  it("always prefers a prompt-satisfying candidate over model quality", () => {
    const selection = selectMaskCandidate(
      [
        candidate(
          0,
          probability(12, 8, (x) => (x < 5 ? 0.9 : 0.1)),
          0.55,
        ),
        candidate(
          1,
          probability(12, 8, (x) => (x >= 7 ? 0.9 : 0.1)),
          0.99,
        ),
      ],
      {
        prompts: [
          { id: "subject", kind: "subject", point: { x: 0.2, y: 0.5 } },
          {
            id: "background",
            kind: "background",
            point: { x: 0.8, y: 0.5 },
          },
        ],
      },
    );

    expect(selection.candidate.index).toBe(0);
    expect(selection.score.promptViolationCount).toBe(0);
    expect(selection.threshold).toBeGreaterThanOrEqual(0.35);
    expect(selection.threshold).toBeLessThanOrEqual(0.65);
  });

  it("uses box leakage and continuity to break otherwise equal scores", () => {
    const previous = thresholdProbabilityMask(
      probability(10, 10, (x, y) =>
        x >= 3 && x <= 6 && y >= 3 && y <= 6 ? 1 : 0,
      ),
      0.5,
    );
    const selection = selectMaskCandidate(
      [
        candidate(
          0,
          probability(10, 10, (x, y) =>
            x >= 3 && x <= 6 && y >= 3 && y <= 6 ? 0.9 : 0.1,
          ),
          0.7,
        ),
        candidate(
          1,
          probability(10, 10, (x, y) =>
            x >= 1 && x <= 8 && y >= 1 && y <= 8 ? 0.9 : 0.1,
          ),
          0.7,
        ),
      ],
      {
        previousMask: previous,
        prompts: [
          { id: "subject", kind: "subject", point: { x: 0.5, y: 0.5 } },
        ],
        subjectBox: { bottom: 0.7, left: 0.3, right: 0.7, top: 0.3 },
      },
    );

    expect(selection.candidate.index).toBe(0);
    expect(selection.score.boxAlignment).toBe(1);
    expect(selection.score.continuity).toBe(1);
  });

  it("counts constraints and computes deterministic IoU", () => {
    const left: SubjectMask = {
      data: Uint8Array.from([255, 255, 0, 0]),
      height: 2,
      width: 2,
    };
    const right: SubjectMask = {
      data: Uint8Array.from([255, 0, 255, 0]),
      height: 2,
      width: 2,
    };
    expect(maskIoU(left, right)).toBeCloseTo(1 / 3);
    expect(
      countPromptViolations(left, [
        { id: "subject", kind: "subject", point: { x: 0.1, y: 0.1 } },
        { id: "background", kind: "background", point: { x: 0.6, y: 0.1 } },
      ]),
    ).toBe(1);
  });
});
