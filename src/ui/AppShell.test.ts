import { describe, expect, it } from "vitest";

import { renderEditorHeader } from "./AppShell";

describe("editor shell header", () => {
  it("keeps only the shelf action, work name, and shell size", () => {
    const markup = renderEditorHeader("星空の<一発>", "medium");

    expect(markup).toContain("data-editor-header");
    expect(markup).toContain("← 花火棚へ戻る");
    expect(markup).toContain('value="星空の&lt;一発&gt;"');
    expect(markup).toContain('<option value="medium" selected>中玉</option>');
    expect(markup).not.toContain("data-editor-header-save-state");
    expect(markup).not.toContain("実物の材料・配合・製造条件");
  });
});
