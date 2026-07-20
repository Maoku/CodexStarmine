import { describe, expect, it } from "vitest";

import type { LayerIntentV4, SectionRef } from "../../data";
import { synchronizeEditorSection } from "./EditorSectionState";

const current: SectionRef = { plane: "xy", ratio: 0.5 };

describe("synchronizeEditorSection", () => {
  it("restores a selected pattern section from document history", () => {
    const patternLayer: LayerIntentV4 = {
      authoringMode: "pattern",
      defaultStarId: "star-test",
      id: "pattern-test",
      ignitionOffset: 0,
      locked: false,
      name: "型物テスト",
      pattern: {
        density: 48,
        rotationDegrees: 0,
        scale: 0.8,
        section: { plane: "yz", ratio: 0.3 },
        template: "heart",
      },
      radialSpeedScale: 1,
      visible: true,
    };

    expect(synchronizeEditorSection(current, patternLayer)).toEqual({
      plane: "yz",
      ratio: 0.3,
    });
    expect(synchronizeEditorSection(current, patternLayer)).not.toBe(
      patternLayer.pattern.section,
    );
  });

  it("keeps transient view sections for manual layers", () => {
    const manualLayer: LayerIntentV4 = {
      authoringMode: "manual",
      defaultStarId: "star-test",
      id: "manual-test",
      ignitionOffset: 0,
      locked: false,
      name: "手動テスト",
      points: [],
      radialSpeedScale: 1,
      visible: true,
    };

    expect(synchronizeEditorSection(current, manualLayer)).toBe(current);
    expect(synchronizeEditorSection(current, undefined)).toBe(current);
  });
});
