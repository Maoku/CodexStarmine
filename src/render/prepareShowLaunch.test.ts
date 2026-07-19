import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import {
  CHRYSANTHEMUM_PRESET,
  DesignRepository,
  ensureFireworkDesignV4,
  type StorageLike,
} from "../data";
import { applyImagePlacementToDraft } from "../ui/craft/ImagePlacementApplication";
import { prepareShowLaunch } from "./prepareShowLaunch";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function speed(vector: { x: number; y: number; z: number }): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

describe("prepareShowLaunch", () => {
  it("preserves image-derived point radii after a shelf round trip", () => {
    const repository = new DesignRepository(
      memoryStorage(),
      () => "image-free-view",
    );
    const intent = ensureFireworkDesignV4(CHRYSANTHEMUM_PRESET);
    const defaultStarId = Object.keys(intent.starDefinitions)[0];
    intent.layers = [
      {
        authoringMode: "manual",
        defaultStarId,
        id: "image-layer",
        ignitionOffset: 0,
        locked: false,
        name: "画像由来",
        points: [],
        radialSpeedScale: 1,
        visible: true,
      },
    ];
    const applied = applyImagePlacementToDraft(
      intent,
      {
        colors: [0x123456, 0xf0a040],
        enhanceDarkColors: false,
        imageStarKind: "solid",
        points: [
          { x: 0.2, y: 0 },
          { x: 0.8, y: 0 },
        ],
        preserveColorAssignments: true,
      },
      {
        applyMode: "replace",
        layerId: "image-layer",
        section: { plane: "xy", ratio: 0.5 },
      },
    );
    expect(applied.status).toBe("applied");

    const saved = repository.saveIntent(intent);
    const reloaded = repository.findIntent(saved.id);
    if (!reloaded) throw new Error("saved image design was not found");

    const launch = prepareShowLaunch(reloaded, "medium", 1234);
    const stars = launch.compiledPlan.stars.filter(
      (star) => star.layerID === "image-layer",
    );
    const radiusRatio =
      speed(stars[1].initialVelocity) / speed(stars[0].initialVelocity);

    expect(launch.design.schemaVersion).toBe(3);
    expect(stars).toHaveLength(2);
    expect(radiusRatio).toBeGreaterThan(3.5);
    expect(
      stars.every((star) => star.definition.id.startsWith("star-image-solid-")),
    ).toBe(true);
  });

  it("keeps preset launch compilation unchanged", () => {
    const launch = prepareShowLaunch(CHRYSANTHEMUM_PRESET, "large", 77);
    const resized = { ...CHRYSANTHEMUM_PRESET, sizeClass: "large" as const };

    expect(launch.design).toEqual(resized);
    expect(launch.compiledPlan).toEqual(compileFireworkDesign(resized, 77));
  });
});
