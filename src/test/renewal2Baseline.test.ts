import { describe, expect, it } from "vitest";

import { isFireworkDesignV3 } from "../data";
import {
  RENEWAL2_CHILD_FIXTURE,
  RENEWAL2_CORE_FIXTURE,
  RENEWAL2_HEART_PATTERN_FIXTURE,
  RENEWAL2_MANUAL_OVERRIDE_FIXTURE,
  RENEWAL2_V3_FIXTURES,
} from "./fixtures/renewal2Baseline";

describe("Renewal2 Phase 0 fixtures", () => {
  it("keeps every migration fixture valid under the current v3 contract", () => {
    expect(RENEWAL2_V3_FIXTURES).toHaveLength(5);
    expect(RENEWAL2_V3_FIXTURES.every(isFireworkDesignV3)).toBe(true);
  });

  it("captures pattern, manual override, core, and child migration cases", () => {
    expect(RENEWAL2_HEART_PATTERN_FIXTURE.layers).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "pattern" })]),
    );
    expect(RENEWAL2_MANUAL_OVERRIDE_FIXTURE.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "spherical",
          placement: "manual",
          overrides: [
            expect.objectContaining({ index: 0, position: expect.any(Object) }),
          ],
        }),
      ]),
    );
    expect(RENEWAL2_CORE_FIXTURE.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "芯", radius: 0.55 }),
      ]),
    );
    expect(RENEWAL2_CHILD_FIXTURE.layers).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "child" })]),
    );
  });
});
