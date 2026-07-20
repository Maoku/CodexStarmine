import { describe, expect, it } from "vitest";

import {
  editorLoadLevel,
  renderEditorTransport,
  type EditorTransportModel,
} from "./EditorTransport";

function model(
  overrides: Partial<EditorTransportModel> = {},
): EditorTransportModel {
  return {
    canRedo: false,
    canUndo: true,
    dirty: false,
    load: { level: "good", limit: 6_000, maximumParticles: 1_240 },
    message: { kind: "tip", text: "レイヤーを選んで編集します" },
    ...overrides,
  };
}

describe("EditorTransport", () => {
  it("renders undo, redo, message, load, save, and check in DOM order", () => {
    const markup = renderEditorTransport(model());
    const tokens = [
      'data-action="undo"',
      'data-action="redo"',
      "data-editor-message",
      "data-editor-load",
      'data-action="save"',
      'data-action="check"',
    ];

    expect(tokens.map((token) => markup.indexOf(token))).toEqual(
      [...tokens]
        .map((token) => markup.indexOf(token))
        .sort((left, right) => left - right),
    );
  });

  it("exposes saved and dirty states without relying on color", () => {
    const saved = renderEditorTransport(model());
    const dirty = renderEditorTransport(model({ dirty: true }));

    expect(saved).toContain('data-save-state="saved"');
    expect(saved).toContain("保存済み");
    expect(dirty).toContain('data-save-state="dirty"');
    expect(dirty).toContain("未保存の変更あり");
  });

  it("renders every load level and only offers simplification when useful", () => {
    expect(editorLoadLevel(2_000)).toBe("good");
    expect(editorLoadLevel(2_001)).toBe("warning");
    expect(editorLoadLevel(6_001)).toBe("overload");

    const good = renderEditorTransport(model());
    const warning = renderEditorTransport(
      model({
        load: { level: "warning", limit: 6_000, maximumParticles: 3_800 },
      }),
    );
    const overload = renderEditorTransport(
      model({
        load: { level: "overload", limit: 6_000, maximumParticles: 6_420 },
      }),
    );
    expect(good).toContain("負荷</span><strong>良好 · 1,240 / 6,000");
    expect(good).not.toContain("自動簡略化");
    expect(warning).toContain("注意 · 3,800 / 6,000");
    expect(warning).toContain("自動簡略化");
    expect(overload).toContain("超過 · 6,420 / 6,000");
    expect(overload).toContain("自動簡略化");
  });

  it("labels message kinds in attributes and visible copy", () => {
    const warning = renderEditorTransport(
      model({ message: { kind: "warning", text: "星数を減らしてください" } }),
    );

    expect(warning).toContain('data-message-kind="warning"');
    expect(warning).toContain("<b>注意</b>");
    expect(warning).toContain("星数を減らしてください");
  });
});
