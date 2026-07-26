import { describe, expect, it } from "vitest";

import {
  NEW_LAYER_GUIDANCE,
  NO_LAYER_GUIDANCE,
  selectedStarGuidance,
} from "./EditorWorkflowGuidance";

describe("EditorWorkflowGuidance", () => {
  it("guides an empty design toward creating its first layer", () => {
    expect(NO_LAYER_GUIDANCE).toContain("レイヤーを追加");
    expect(NO_LAYER_GUIDANCE).toContain("＋ 既定");
  });

  it("guides a newly created layer toward the virtual-star tray", () => {
    expect(NEW_LAYER_GUIDANCE).toContain("仮想星の部品皿");
    expect(NEW_LAYER_GUIDANCE).toContain("仮想星を選択");
  });

  it("offers the relevant next step after choosing a star", () => {
    expect(selectedStarGuidance("preset")).toContain("パラメータ");
    expect(selectedStarGuidance("pattern")).toContain("操作面");
    expect(selectedStarGuidance("manual")).toContain("操作面");
  });
});
