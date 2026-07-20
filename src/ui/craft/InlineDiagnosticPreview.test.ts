import { describe, expect, it } from "vitest";

import { buildCompiledBurstPreviewModel } from "../../render/preview/CompiledBurstPreviewRenderer";
import { CHRYSANTHEMUM_PRESET } from "../../data";
import { renderInlineDiagnosticPreview } from "./InlineDiagnosticPreview";

describe("InlineDiagnosticPreview", () => {
  it("keeps fixed-seed playback controls in a collapsible dock", () => {
    const model = buildCompiledBurstPreviewModel(CHRYSANTHEMUM_PRESET);
    const markup = renderInlineDiagnosticPreview(model, true, 4);

    expect(markup).toContain("data-preview-dock");
    expect(markup).toContain('data-preview-expanded="false"');
    expect(markup).toContain('data-action="toggle-preview"');
    expect(markup).toContain('data-action="reset-preview"');
    expect(markup).toContain("固定 seed");
    expect(markup).toContain(`${model.totalStarCount}星の打上結果プレビュー`);
  });
});
