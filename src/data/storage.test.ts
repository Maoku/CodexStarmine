import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "./presets";
import {
  DesignRepository,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  type StorageLike,
} from "./storage";

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

  it("moves the last saved design to the front for updated-order shelves", () => {
    let id = 0;
    const repository = new DesignRepository(memoryStorage(), () => `${++id}`);
    const first = repository.save({
      ...CHRYSANTHEMUM_PRESET,
      name: "先に保存",
    });
    repository.save({ ...CHRYSANTHEMUM_PRESET, name: "後に保存" });

    repository.save({ ...first, name: "最後に更新" });

    expect(repository.list().map((design) => design.name)).toEqual([
      "最後に更新",
      "後に保存",
    ]);
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

  it("migrates a complete v1 library to v2 without deleting v1", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const v1 = structuredClone(CHRYSANTHEMUM_PRESET) as unknown as Record<
      string,
      unknown
    >;
    for (const key of [
      "assemblySeed",
      "burstField",
      "description",
      "launchVariation",
      "layers",
      "realism",
      "schemaVersion",
      "starDefinitions",
      "themeColors",
    ]) {
      delete v1[key];
    }
    values.set(STORAGE_KEY_V1, JSON.stringify({ version: 1, designs: [v1] }));
    const migrated = new DesignRepository(storage).list();
    expect(migrated[0].schemaVersion).toBe(2);
    expect(migrated[0].layers.length).toBeGreaterThan(0);
    expect(values.has(STORAGE_KEY_V1)).toBe(true);
    expect(values.has(STORAGE_KEY_V2)).toBe(true);
  });

  it("does not partially migrate a damaged v1 library", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    values.set(
      STORAGE_KEY_V1,
      JSON.stringify({ version: 1, designs: [{ id: "broken" }] }),
    );
    const repository = new DesignRepository(storage);
    expect(repository.list()).toEqual([]);
    expect(repository.migrationWarning).toContain("自動移行せず");
    expect(values.has(STORAGE_KEY_V2)).toBe(false);
  });
});
