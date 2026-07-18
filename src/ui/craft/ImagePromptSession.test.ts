import { describe, expect, it } from "vitest";

import {
  addImagePrompt,
  clearImagePromptSession,
  clearImagePrompts,
  clearSubjectBox,
  createImagePromptSession,
  IMAGE_PROMPT_LIMITS,
  moveImagePrompt,
  moveSubjectBox,
  normalizeImageRect,
  removeImagePrompt,
  setSubjectBox,
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

  it("normalizes, moves, clears, and restores the subject box", () => {
    const initial = createImagePromptSession();
    const boxed = setSubjectBox(initial, {
      bottom: 0.2,
      left: 0.9,
      right: 0.1,
      top: 0.8,
    });
    expect(boxed.subjectBox).toEqual({
      bottom: 0.8,
      left: 0.1,
      right: 0.9,
      top: 0.2,
    });
    expect(boxed.revision).toBe(1);

    const moved = moveSubjectBox(boxed, { x: 0.5, y: -0.5 });
    expect(moved.subjectBox).toEqual({
      bottom: 0.6,
      left: 0.2,
      right: 1,
      top: 0,
    });
    expect(moved.revision).toBe(2);
    expect(undoImagePrompt(moved).subjectBox).toEqual(boxed.subjectBox);
    expect(clearSubjectBox(moved).subjectBox).toBeUndefined();
    expect(normalizeImageRect({ x: 2, y: -1 }, { x: 0.4, y: 0.6 })).toEqual({
      bottom: 0.6,
      left: 0.4,
      right: 1,
      top: 0,
    });
  });

  it("records a point drag as one undoable revision", () => {
    const added = addImagePrompt(createImagePromptSession(), {
      id: "subject",
      kind: "subject",
      point: { x: 0.25, y: 0.25 },
    });
    if (!added.changed) throw new Error("subject was not added");
    const moved = moveImagePrompt(added.state, "subject", { x: 2, y: -1 });

    expect(moved.prompts[0].point).toEqual({ x: 1, y: 0 });
    expect(moved.revision).toBe(2);
    expect(undoImagePrompt(moved).prompts[0].point).toEqual({
      x: 0.25,
      y: 0.25,
    });
    expect(moveImagePrompt(moved, "missing", { x: 0, y: 0 })).toBe(moved);
  });

  it("can clear prompts without the box or clear the entire session", () => {
    let state = setSubjectBox(createImagePromptSession(), {
      bottom: 0.8,
      left: 0.2,
      right: 0.8,
      top: 0.2,
    });
    const added = addImagePrompt(state, {
      id: "subject",
      kind: "subject",
      point: { x: 0.5, y: 0.5 },
    });
    if (!added.changed) throw new Error("subject was not added");
    state = clearImagePrompts(added.state);
    expect(state.prompts).toEqual([]);
    expect(state.subjectBox).toBeDefined();
    state = clearImagePromptSession(state);
    expect(state.prompts).toEqual([]);
    expect(state.subjectBox).toBeUndefined();
  });
});
