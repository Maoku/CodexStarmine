import { describe, expect, it } from "vitest";

import {
  RENEWAL3_BASELINE_FIXTURES,
  RENEWAL3_BASELINE_VIEWPORTS,
} from "./fixtures/renewal3Baseline";

describe("Renewal3 Phase 0 baselines", () => {
  it("records all required current-state fixture categories", () => {
    expect(Object.keys(RENEWAL3_BASELINE_FIXTURES).sort()).toEqual([
      "camera",
      "lake",
      "manual",
      "pattern",
      "preview",
      "title",
      "workbench",
    ]);
  });

  it("records desktop, compact desktop, and mobile screenshots", () => {
    expect(RENEWAL3_BASELINE_VIEWPORTS).toEqual([
      expect.objectContaining({ height: 900, width: 1440 }),
      expect.objectContaining({ height: 720, width: 1280 }),
      expect.objectContaining({ height: 844, width: 390 }),
    ]);
    expect(
      RENEWAL3_BASELINE_VIEWPORTS.every(({ screenshot }) =>
        screenshot.endsWith(".png"),
      ),
    ).toBe(true);
  });
});
