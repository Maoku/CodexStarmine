import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET, HEART_PRESET, PEONY_PRESET } from "../../data";
import {
  buildShelfThumbnailModel,
  filterAndSortShelfDesigns,
  formatShelfUpdatedAt,
  isBuiltInShelfPreset,
  renderShelfImportConflictDialog,
} from "./FireworkShelfScreen";

describe("FireworkShelfScreen models", () => {
  const designs = [
    { ...CHRYSANTHEMUM_PRESET, id: "custom-1", name: "月の菊" },
    { ...PEONY_PRESET, id: "custom-2", name: "青い牡丹" },
  ];

  it("keeps repository order as updated order and filters by visible copy", () => {
    expect(
      filterAndSortShelfDesigns(designs, "", "updated").map(
        (design) => design.id,
      ),
    ).toEqual(["custom-1", "custom-2"]);
    expect(filterAndSortShelfDesigns(designs, "牡丹", "updated")).toEqual([
      designs[1],
    ]);
  });

  it("sorts names without mutating repository order", () => {
    expect(
      filterAndSortShelfDesigns(designs, "", "name").map(
        (design) => design.name,
      ),
    ).toEqual(["月の菊", "青い牡丹"].sort((a, b) => a.localeCompare(b, "ja")));
    expect(designs.map((design) => design.id)).toEqual([
      "custom-1",
      "custom-2",
    ]);
  });

  it("builds a compact section or pattern thumbnail from visible layers", () => {
    expect(buildShelfThumbnailModel(CHRYSANTHEMUM_PRESET)).toMatchObject({
      kind: "section",
    });
    const heart = buildShelfThumbnailModel(HEART_PRESET);
    expect(heart.kind).toBe("pattern");
    expect(heart.rings.length).toBeGreaterThan(0);
    expect(heart.rings.length).toBeLessThanOrEqual(3);
  });

  it("distinguishes immutable built-in presets from saved works", () => {
    expect(isBuiltInShelfPreset(CHRYSANTHEMUM_PRESET)).toBe(true);
    expect(isBuiltInShelfPreset(designs[0])).toBe(false);
  });

  it("formats update timestamps in the requested local time zone", () => {
    expect(
      formatShelfUpdatedAt("2026-07-17T03:00:00.000Z", "ja-JP", "Asia/Tokyo"),
    ).toContain("12:00");
    expect(formatShelfUpdatedAt("broken", "ja-JP")).toBe("更新日時不明");
  });

  it("asks before replacing colliding firework IDs", () => {
    const dialog = renderShelfImportConflictDialog(3);
    expect(dialog).toContain("3件の花火玉が重複しています。置き換えますか？");
    expect(dialog).toContain('data-action="cancel-dialog"');
    expect(dialog).toContain('data-action="confirm-import-skip"');
    expect(dialog).toContain('data-action="confirm-import-replace"');
  });
});
