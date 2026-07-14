import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "./presets";
import { DesignRepository, type StorageLike } from "./storage";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("DesignRepository", () => {
  it("saves a preset as a custom design and reloads it", () => {
    const storage = memoryStorage();
    const repository = new DesignRepository(storage, () => "first");
    const saved = repository.save({
      ...CHRYSANTHEMUM_PRESET,
      name: "湖畔の菊",
    });
    expect(saved.id).toBe("custom-first");
    expect(new DesignRepository(storage).list()).toEqual([saved]);
  });

  it("updates an existing custom design without duplicating it", () => {
    const repository = new DesignRepository(memoryStorage(), () => "stable");
    const saved = repository.save(CHRYSANTHEMUM_PRESET);
    repository.save({ ...saved, name: "更新後" });
    expect(repository.list()).toHaveLength(1);
    expect(repository.list()[0].name).toBe("更新後");
  });

  it("duplicates and removes custom designs", () => {
    let id = 0;
    const repository = new DesignRepository(memoryStorage(), () => `${++id}`);
    const saved = repository.save(CHRYSANTHEMUM_PRESET);
    const copy = repository.duplicate(saved.id);
    expect(copy?.name).toContain("複製");
    expect(repository.list()).toHaveLength(2);
    expect(repository.remove(saved.id)).toBe(true);
    expect(repository.list()).toEqual([copy]);
  });

  it("ignores corrupted persisted data", () => {
    const storage: StorageLike = {
      getItem: () => "not-json",
      setItem: () => undefined,
    };
    expect(new DesignRepository(storage).list()).toEqual([]);
  });
});
