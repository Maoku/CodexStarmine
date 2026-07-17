import { describe, expect, it } from "vitest";

import {
  addImagePrompt,
  clearImagePrompts,
  createImagePromptSession,
  IMAGE_PROMPT_LIMITS,
  removeImagePrompt,
  undoImagePrompt,
} from "./ImagePromptSession";

describe("ImagePromptSession", () => {
  it("enforces per-kind limits and clamps normalized coordinates", () => {
    let state = createImagePromptSession();
    for (let index = 0; index < IMAGE_PROMPT_LIMITS.subject; index += 1) {
      const result = addImagePrompt(state, {
        id: `subject-${index}`,
        kind: "subject",
        point: { x: index === 0 ? -1 : 0.5, y: index === 0 ? 2 : 0.5 },
      });
      expect(result.changed).toBe(true);
      if (result.changed) state = result.state;
    }
    expect(state.prompts[0].point).toEqual({ x: 0, y: 1 });
    expect(state.revision).toBe(3);
    expect(
      addImagePrompt(state, {
        id: "subject-over-limit",
        kind: "subject",
        point: { x: 0.2, y: 0.2 },
      }),
    ).toEqual({ changed: false, reason: "limit-reached" });
  });

  it("supports deterministic removal, clear, and undo revisions", () => {
    const initial = createImagePromptSession();
    const first = addImagePrompt(initial, {
      id: "subject-1",
      kind: "subject",
      point: { x: 0.4, y: 0.4 },
    });
    if (!first.changed) throw new Error("subject was not added");
    const second = addImagePrompt(first.state, {
      id: "feature-1",
      kind: "feature",
      point: { x: 0.45, y: 0.45 },
    });
    if (!second.changed) throw new Error("feature was not added");

    const removed = removeImagePrompt(second.state, "subject-1");
    expect(removed.prompts.map((prompt) => prompt.id)).toEqual(["feature-1"]);
    expect(undoImagePrompt(removed).prompts.map((prompt) => prompt.id)).toEqual(
      ["subject-1", "feature-1"],
    );
    const cleared = clearImagePrompts(second.state);
    expect(cleared.prompts).toEqual([]);
    expect(undoImagePrompt(cleared).prompts).toEqual(second.state.prompts);
    expect(removeImagePrompt(second.state, "missing")).toBe(second.state);
  });
});
