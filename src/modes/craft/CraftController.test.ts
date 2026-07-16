import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../../core/burst";
import {
  DesignRepository,
  FIREWORK_PRESETS,
  type StorageLike,
} from "../../data";
import { RENEWAL_BASELINE_SEED } from "../../test/fixtures/renewalBaseline";
import { CraftController } from "./CraftController";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("CraftController renewal regression", () => {
  it("keeps built-in presets on the shelf independently from local storage", () => {
    const controller = new CraftController(
      new DesignRepository(
        memoryStorage(),
        () => "from-preset",
        () => new Date("2026-07-17T06:00:00.000Z"),
      ),
    );

    expect(controller.savedDesigns).toEqual([]);
    expect(controller.shelfDesigns.map((design) => design.id)).toEqual(
      FIREWORK_PRESETS.map((preset) => preset.id),
    );

    expect(controller.load(FIREWORK_PRESETS[0].id)).toBe(true);
    expect(controller.draft.id).toBe(FIREWORK_PRESETS[0].id);
    expect(controller.save().id).toBe("custom-from-preset");
    expect(controller.shelfDesigns).toHaveLength(FIREWORK_PRESETS.length + 1);
    expect(controller.shelfLibrary.updatedAtById).toEqual({
      "custom-from-preset": "2026-07-17T06:00:00.000Z",
    });
  });

  it("creates an unsaved initial-setup draft without writing the library", () => {
    const repository = new DesignRepository(memoryStorage(), () => "new-draft");
    const controller = new CraftController(repository);
    let dirty = false;
    const unsubscribe = controller.document.subscribe((snapshot) => {
      dirty = snapshot.dirty;
    });

    controller.startNewDraft("large", "peony");

    expect(controller.draft).toMatchObject({
      id: "draft-new",
      name: "新しい牡丹",
      pattern: "peony",
      sizeClass: "large",
    });
    expect(dirty).toBe(true);
    expect(controller.savedDesigns).toEqual([]);

    const saved = controller.save();
    expect(saved.id).toBe("custom-new-draft");
    expect(controller.savedDesigns).toEqual([saved]);
    expect(dirty).toBe(false);
    unsubscribe();
  });

  it("starts a blank setup draft with only the minimum outer layer", () => {
    const controller = new CraftController(
      new DesignRepository(memoryStorage()),
    );

    controller.startNewDraft("small", "blank");

    expect(controller.draft).toMatchObject({
      id: "draft-new",
      name: "無題の花火",
      sizeClass: "small",
    });
    expect(controller.draft.layers).toHaveLength(1);
    expect(controller.draft.childBursts).toEqual([]);
    expect(controller.draft.coreLayers).toEqual([]);
  });

  it("keeps the current craft, save, load, completed launch, and delete flow", () => {
    const storage = memoryStorage();
    const controller = new CraftController(
      new DesignRepository(storage, () => "renewal-flow"),
    );

    controller.selectPattern("heart");
    controller.updateName("回帰確認のハート");
    controller.updateSize("large");
    controller.updateColors(0xff335f, 0x5f8cff);
    const saved = controller.save();

    expect(saved.id).toBe("custom-renewal-flow");
    expect(controller.savedDesigns).toEqual([saved]);

    const launchPlan = compileFireworkDesign(saved, RENEWAL_BASELINE_SEED);
    expect(launchPlan.stars.length).toBeGreaterThan(0);
    expect(launchPlan.bounds.radius).toBeGreaterThan(0);

    const reloaded = new CraftController(new DesignRepository(storage));
    reloaded.startBlank();
    expect(reloaded.load(saved.id)).toBe(true);
    expect(reloaded.draft).toEqual(saved);
    expect(reloaded.remove(saved.id)).toBe(true);
    expect(reloaded.savedDesigns).toEqual([]);
    expect(reloaded.draft.id).toBe("draft-new");
  });
});
