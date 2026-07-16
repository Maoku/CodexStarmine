import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET, snapshotStarLibrary } from "../../data";
import { CraftDocumentStore } from "../../modes/craft";
import { applyImagePlacementToDraft } from "./ImagePlacementApplication";
import {
  extractImagePlacement,
  IMAGE_PLACEMENT_SAFETY_RADIUS,
  resolveImageStars,
  type ImageDataLike,
} from "./ImagePlacementRecipe";

function image(
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data.set(pixel(x, y), offset);
    }
  }
  return { data, height, width };
}

describe("ImagePlacementRecipe", () => {
  it("extracts a deterministic silhouette from a transparent image", () => {
    const source = image(48, 48, (x, y) =>
      Math.hypot(x - 23.5, y - 23.5) <= 17 ? [224, 151, 74, 255] : [0, 0, 0, 0],
    );
    const first = extractImagePlacement(source, { targetCount: 48 });
    const second = extractImagePlacement(source, { targetCount: 48 });

    expect(first).toEqual(second);
    expect(first.points).toHaveLength(48);
    expect(first.colors).toHaveLength(first.points.length);
    first.points.forEach((point) =>
      expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(
        IMAGE_PLACEMENT_SAFETY_RADIUS,
      ),
    );
    expect(
      Math.abs(
        first.points.reduce((sum, point) => sum + point.y, 0) /
          first.points.length,
      ),
    ).toBeLessThan(0.12);
  });

  it("separates a dark subject from an opaque white background", () => {
    const source = image(40, 24, (x, y) =>
      x >= 8 && x <= 31 && y >= 5 && y <= 18
        ? [20, 50, 90, 255]
        : [255, 255, 255, 255],
    );
    const placement = extractImagePlacement(source, { targetCount: 32 });

    expect(placement.points).toHaveLength(32);
    expect(new Set(placement.colors)).toEqual(new Set([0x14325a]));
  });

  it("places points along the contour instead of filling the subject", () => {
    const source = image(48, 48, (x, y) =>
      Math.hypot(x - 23.5, y - 23.5) <= 17 ? [224, 151, 74, 255] : [0, 0, 0, 0],
    );
    const placement = extractImagePlacement(source, { targetCount: 48 });
    const pixelScale = (IMAGE_PLACEMENT_SAFETY_RADIUS * 2) / Math.hypot(48, 48);

    expect(placement.points).toHaveLength(48);
    placement.points.forEach((point) => {
      const radius = Math.hypot(point.x, point.y);
      expect(radius).toBeGreaterThan(13 * pixelScale);
      expect(radius).toBeLessThan(18.5 * pixelScale);
    });
  });

  it("keeps interior feature points such as eyes on the contour map", () => {
    const eyeCenters = [
      { x: 23, y: 25 },
      { x: 37, y: 25 },
    ];
    const source = image(60, 60, (x, y) => {
      if (eyeCenters.some((eye) => Math.hypot(x - eye.x, y - eye.y) <= 2.5)) {
        return [30, 30, 40, 255];
      }
      return Math.hypot(x - 30, y - 30) <= 20
        ? [230, 200, 180, 255]
        : [255, 255, 255, 255];
    });
    const placement = extractImagePlacement(source, { targetCount: 64 });
    const pixelScale = (IMAGE_PLACEMENT_SAFETY_RADIUS * 2) / Math.hypot(60, 60);
    const toSection = (x: number, y: number) => ({
      x: (x + 0.5 - 30) * pixelScale,
      y: (30 - (y + 0.5)) * pixelScale,
    });
    const nearEye = (point: { x: number; y: number }) =>
      eyeCenters.some((eye) => {
        const center = toSection(eye.x, eye.y);
        return (
          Math.hypot(point.x - center.x, point.y - center.y) <= 5.5 * pixelScale
        );
      });
    const nearFaceRim = (point: { x: number; y: number }) =>
      Math.abs(Math.hypot(point.x, point.y) - 20 * pixelScale) <=
      4 * pixelScale;

    expect(placement.points.length).toBeGreaterThan(0);
    eyeCenters.forEach((eye) => {
      const center = toSection(eye.x, eye.y);
      expect(
        placement.points.some(
          (point) =>
            Math.hypot(point.x - center.x, point.y - center.y) <=
            5.5 * pixelScale,
        ),
      ).toBe(true);
    });
    placement.points.forEach((point) => {
      expect(nearEye(point) || nearFaceRim(point)).toBe(true);
    });
  });

  it("ignores faint detached strips and image crop edges", () => {
    const source = image(64, 64, (x, y) => {
      if (x <= 3) return [215, 215, 225, 255];
      return Math.hypot(x - 36, y - 32) <= 16
        ? [20, 50, 90, 255]
        : [255, 255, 255, 255];
    });
    const placement = extractImagePlacement(source, { targetCount: 48 });
    const pixelScale = (IMAGE_PLACEMENT_SAFETY_RADIUS * 2) / Math.hypot(64, 64);
    const discCenter = { x: (36 + 0.5 - 32) * pixelScale, y: 0 };

    expect(placement.points.length).toBeGreaterThan(0);
    placement.points.forEach((point) => {
      expect(
        Math.hypot(point.x - discCenter.x, point.y - discCenter.y),
      ).toBeLessThan(18 * pixelScale);
    });
  });

  it("rejects an image without a distinguishable subject", () => {
    const source = image(20, 20, () => [120, 120, 120, 255]);
    expect(extractImagePlacement(source).points).toEqual([]);
  });

  it("reuses near existing stars and creates at most four derived stars", () => {
    const definitions = snapshotStarLibrary();
    expect(resolveImageStars([0xff3b42], definitions).starIds).toEqual([
      "star-solid-red",
    ]);
    definitions["star-image-1"] = {
      ...structuredClone(definitions["star-solid-red"]),
      id: "star-image-1",
    };
    const colors = [0x010203, 0x123456, 0x10e090, 0xe010d0, 0xf0e010];
    const resolution = resolveImageStars(colors, definitions);

    expect(resolution.starIds).toHaveLength(colors.length);
    expect(resolution.createdStarIds.length).toBeLessThanOrEqual(4);
    expect(resolution.createdStarIds).not.toContain("star-image-1");
    resolution.createdStarIds.forEach((starId) =>
      expect(resolution.starDefinitions[starId].colorStages).toHaveLength(4),
    );
  });

  it("applies points and derived stars as one undoable v4 edit", () => {
    const store = new CraftDocumentStore(CHRYSANTHEMUM_PRESET);
    store.updateIntent("手動レイヤーを追加", (draft) => {
      draft.layers.push({
        authoringMode: "manual",
        defaultStarId: "star-solid-red",
        id: "manual-image-test",
        ignitionOffset: 0,
        locked: false,
        name: "画像テスト",
        points: [],
        radialSpeedScale: 1,
        visible: true,
      });
    });
    const before = store.intentDraft;
    store.updateIntent("画像から配置", (draft) => {
      const result = applyImagePlacementToDraft(
        draft,
        {
          colors: [0x010203, 0x123456],
          points: [
            { x: -0.3, y: 0.2 },
            { x: 0.3, y: -0.2 },
          ],
        },
        {
          applyMode: "replace",
          layerId: "manual-image-test",
          section: { plane: "xz", ratio: 0.3 },
        },
      );
      expect(result.status).toBe("applied");
    });

    const applied = store.intentDraft;
    const layer = applied.layers.find(
      (candidate) => candidate.id === "manual-image-test",
    );
    expect(layer?.authoringMode === "manual" ? layer.points : []).toHaveLength(
      2,
    );
    expect(Object.keys(applied.starDefinitions).length).toBeGreaterThanOrEqual(
      Object.keys(before.starDefinitions).length,
    );
    store.undo();
    expect(store.intentDraft).toEqual(before);
    store.redo();
    expect(store.intentDraft).toEqual(applied);
  });

  it("supports append and replace while refusing a locked manual layer", () => {
    const draft = new CraftDocumentStore(CHRYSANTHEMUM_PRESET).intentDraft;
    draft.layers.push({
      authoringMode: "manual",
      defaultStarId: "star-solid-red",
      id: "manual-apply-modes",
      ignitionOffset: 0,
      locked: false,
      name: "適用方法テスト",
      points: [],
      radialSpeedScale: 1,
      visible: true,
    });
    const options = {
      applyMode: "append" as const,
      layerId: "manual-apply-modes",
      section: { plane: "xy" as const, ratio: 0.5 as const },
    };
    const darkPlacement = {
      colors: [0x010203],
      points: [{ x: -0.2, y: 0 }],
    };
    const first = applyImagePlacementToDraft(draft, darkPlacement, options);
    const second = applyImagePlacementToDraft(draft, darkPlacement, options);
    const manual = draft.layers.find(
      (candidate) => candidate.id === "manual-apply-modes",
    );
    expect(first.status).toBe("applied");
    expect(second.status).toBe("applied");
    expect(
      manual?.authoringMode === "manual" ? manual.points : [],
    ).toHaveLength(2);

    const replaced = applyImagePlacementToDraft(
      draft,
      { colors: [0xff3b42], points: [{ x: 0.2, y: 0 }] },
      { ...options, applyMode: "replace" },
    );
    expect(replaced.status).toBe("applied");
    expect(
      manual?.authoringMode === "manual" ? manual.points : [],
    ).toHaveLength(1);
    expect(
      Object.keys(draft.starDefinitions).filter((id) =>
        id.startsWith("star-image-"),
      ),
    ).toEqual([]);

    if (manual) manual.locked = true;
    const beforeLockedAttempt = structuredClone(draft);
    expect(
      applyImagePlacementToDraft(draft, darkPlacement, options).status,
    ).toBe("locked");
    expect(draft).toEqual(beforeLockedAttempt);
  });
});
