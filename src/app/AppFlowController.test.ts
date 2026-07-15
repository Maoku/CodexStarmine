import { describe, expect, it, vi } from "vitest";

import { AppFlowController, appScreenKind } from "./AppFlowController";

describe("AppFlowController", () => {
  it("starts safely at mode selection and follows the Phase 1 back routes", () => {
    const flow = new AppFlowController();

    expect(flow.screen).toEqual({ kind: "mode-select" });
    expect(flow.navigate("choose-craft")).toBe(true);
    expect(flow.screen).toEqual({
      kind: "library",
      selectedDesignId: undefined,
    });
    expect(flow.back()).toBe(true);
    expect(flow.screen).toEqual({ kind: "mode-select" });

    expect(flow.navigate("choose-free")).toBe(true);
    expect(appScreenKind(flow.screen)).toBe("viewer-free");
    expect(flow.back()).toBe(true);
    expect(flow.screen).toEqual({ kind: "mode-select" });
  });

  it("rejects routes that do not start at the active screen", () => {
    const flow = new AppFlowController();

    expect(flow.navigate("edit-design", { designId: "custom-a" })).toBe(false);
    expect(flow.screen).toEqual({ kind: "mode-select" });
  });

  it("keeps initial setup temporary until editing begins", () => {
    const flow = new AppFlowController();

    flow.navigate("choose-craft");
    expect(flow.navigate("create-design")).toBe(true);
    expect(flow.screen).toEqual({
      kind: "initial-setup",
      draft: { sizeClass: "medium", template: "chrysanthemum" },
    });
    expect(flow.back()).toBe(true);
    expect(flow.screen).toMatchObject({ kind: "library" });

    flow.navigate("create-design", {
      draft: { sizeClass: "large", template: "blank" },
    });
    expect(
      flow.navigate("begin-editing", {
        designId: "draft-new",
        origin: "new",
      }),
    ).toBe(true);
    expect(flow.screen).toEqual({
      kind: "editor",
      designId: "draft-new",
      origin: "new",
    });
  });

  it("guards only dirty editor exits and preserves the draft when cancelled", () => {
    const confirmDiscard = vi.fn(() => false);
    const flow = new AppFlowController({ confirmDiscard });

    flow.navigate("choose-craft");
    flow.navigate("edit-design", {
      designId: "custom-a",
      origin: "saved",
    });
    flow.setEditorDirty(true);

    expect(flow.back()).toBe(false);
    expect(flow.screen).toMatchObject({
      kind: "editor",
      designId: "custom-a",
    });
    expect(confirmDiscard).toHaveBeenCalledOnce();

    confirmDiscard.mockReturnValue(true);
    expect(flow.back()).toBe(true);
    expect(flow.screen).toMatchObject({ kind: "library" });
    expect(confirmDiscard).toHaveBeenCalledTimes(2);
    expect(flow.hasUnsavedEditorChanges).toBe(false);
  });

  it("notifies mounted shells and supports unmounting the listener", () => {
    const flow = new AppFlowController();
    const listener = vi.fn();
    const unsubscribe = flow.subscribe(listener);

    flow.navigate("choose-free");
    unsubscribe();
    flow.navigate("back-to-mode-select");

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1]?.[0]).toEqual({
      kind: "viewer",
      context: "free",
      designId: undefined,
    });
  });

  it("restores the same editor after a lake check", () => {
    const flow = new AppFlowController();

    flow.navigate("choose-craft");
    flow.navigate("edit-design", {
      designId: "custom-check",
      origin: "saved",
    });
    flow.navigate("check-on-lake");

    expect(flow.screen).toEqual({
      kind: "viewer",
      context: "check",
      designId: "custom-check",
    });
    expect(flow.back()).toBe(true);
    expect(flow.screen).toEqual({
      kind: "editor",
      designId: "custom-check",
      origin: "saved",
    });
  });
});
