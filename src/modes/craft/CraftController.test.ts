import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../../core/burst";
import { DesignRepository, type StorageLike } from "../../data";
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
