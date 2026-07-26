import { describe, expect, it } from "vitest";

import { BUILTIN_STAR_PRESETS } from "../../data";
import { renderStarEffectEditor } from "./StarEffectEditor";

describe("StarEffectEditor", () => {
  it("renders orthogonal color, light, motion, terminal, trail, and smoke controls", () => {
    const star = BUILTIN_STAR_PRESETS.find(
      (candidate) => candidate.id === "star-popping",
    );
    if (!star) throw new Error("missing popping star");
    const markup = renderStarEffectEditor(star);
    expect(markup).toContain('data-action="duplicate-selected-star"');
    expect(markup).toContain('name="star-effect-stage-color"');
    expect(markup).toContain('name="star-effect-color-playback"');
    expect(markup).toContain('name="star-effect-light-mode"');
    expect(markup).toContain('name="star-effect-terminal-mode"');
    expect(markup).toContain('name="star-effect-motion-mode"');
    expect(markup).toContain('name="star-effect-secondary-mode"');
    expect(markup).toContain('name="star-effect-trail-mode"');
    expect(markup).toContain('name="star-effect-smoke"');
  });

  it("disables every mutation when the selected layer is locked", () => {
    const markup = renderStarEffectEditor(BUILTIN_STAR_PRESETS[0], true);
    expect(markup).toContain('data-action="duplicate-selected-star" disabled');
    expect(markup).toContain('name="star-effect-name"');
    expect(markup).toMatch(/name="star-effect-name"[^>]+disabled/);
  });
});
