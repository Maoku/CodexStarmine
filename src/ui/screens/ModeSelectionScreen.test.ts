import { describe, expect, it } from "vitest";

import { renderModeSelectionScreenMarkup } from "./ModeSelectionScreen";

describe("mode selection safety note", () => {
  it("keeps the virtual-firework notice on the title screen", () => {
    const markup = renderModeSelectionScreenMarkup();

    expect(markup).toContain("mode-safety-note");
    expect(markup).toContain("仮想花火");
    expect(markup).toContain("実物の材料・配合・製造条件は扱いません");
  });
});
