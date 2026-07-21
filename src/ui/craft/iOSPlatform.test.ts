import { describe, expect, it } from "vitest";

import {
  IOS_SEGMENTATION_IMAGE_MAXIMUM_EDGE,
  segmentationImageMaximumEdge,
} from "./iOSPlatform";

describe("iOSPlatform", () => {
  it("limits iPhone and touch-based iPadOS analysis images to 512px", () => {
    expect(
      segmentationImageMaximumEdge(1024, {
        maxTouchPoints: 5,
        platform: "iPhone",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      }),
    ).toBe(IOS_SEGMENTATION_IMAGE_MAXIMUM_EDGE);
    expect(
      segmentationImageMaximumEdge(1024, {
        maxTouchPoints: 5,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      }),
    ).toBe(IOS_SEGMENTATION_IMAGE_MAXIMUM_EDGE);
  });

  it("keeps the desktop analysis limit unchanged", () => {
    expect(
      segmentationImageMaximumEdge(1024, {
        maxTouchPoints: 0,
        platform: "MacIntel",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      }),
    ).toBe(1024);
  });
});
