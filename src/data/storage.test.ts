import { describe, expect, it } from "vitest";

import { CHRYSANTHEMUM_PRESET } from "./presets";
import {
  DesignRepository,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  STORAGE_KEY_V3,
  STORAGE_KEY_V4,
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

  it("migrates a complete v1 library through v2 and v3 to v4 without deleting old keys", () => {
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
    expect(migrated[0].schemaVersion).toBe(3);
    expect(migrated[0].layers.length).toBeGreaterThan(0);
    expect(values.has(STORAGE_KEY_V1)).toBe(true);
    expect(values.has(STORAGE_KEY_V2)).toBe(true);
    expect(values.has(STORAGE_KEY_V3)).toBe(true);
    expect(values.has(STORAGE_KEY_V4)).toBe(true);
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
    expect(values.has(STORAGE_KEY_V3)).toBe(false);
    expect(values.has(STORAGE_KEY_V4)).toBe(false);
  });

  it("migrates a complete v2 library to v4 while retaining v2 and v3 sources", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const rawV2 = JSON.stringify({
      version: 2,
      designs: [{ ...CHRYSANTHEMUM_PRESET, id: "custom-legacy" }],
    });
    values.set(STORAGE_KEY_V2, rawV2);

    const migrated = new DesignRepository(storage).list();

    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toMatchObject({
      derivationVersion: 1,
      id: "custom-legacy",
      schemaVersion: 3,
    });
    expect(migrated[0].legacyBehavior?.sourceSchemaVersion).toBe(2);
    expect(values.get(STORAGE_KEY_V2)).toBe(rawV2);
    expect(values.has(STORAGE_KEY_V3)).toBe(true);
    expect(values.has(STORAGE_KEY_V4)).toBe(true);
    expect(new DesignRepository(storage).listIntents()[0]).toMatchObject({
      id: "custom-legacy",
      schemaVersion: 4,
    });
  });

  it("does not write v3 or v4 when any v2 work is damaged", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    values.set(
      STORAGE_KEY_V2,
      JSON.stringify({
        version: 2,
        designs: [CHRYSANTHEMUM_PRESET, { id: "broken" }],
      }),
    );

    const repository = new DesignRepository(storage);
    expect(repository.list()).toEqual([]);
    expect(repository.migrationWarning).toContain("v2作品に破損");
    expect(values.has(STORAGE_KEY_V3)).toBe(false);
    expect(values.has(STORAGE_KEY_V4)).toBe(false);
  });

  it("falls back to retained v2 data when the v3 envelope is damaged", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const damagedV3 = JSON.stringify({
      version: 3,
      designs: [{ id: "broken-v3" }],
    });
    values.set(STORAGE_KEY_V3, damagedV3);
    values.set(
      STORAGE_KEY_V2,
      JSON.stringify({ version: 2, designs: [CHRYSANTHEMUM_PRESET] }),
    );

    const repository = new DesignRepository(storage);
    expect(repository.list()[0]).toMatchObject({
      id: CHRYSANTHEMUM_PRESET.id,
      schemaVersion: 3,
    });
    expect(repository.migrationWarning).toContain("v3作品に破損");
    expect(values.get(STORAGE_KEY_V3)).toBe(damagedV3);
    expect(values.has(STORAGE_KEY_V4)).toBe(false);
  });

  it("prefers a valid v4 envelope over retained legacy keys", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const repository = new DesignRepository(storage, () => "v4");
    repository.save({ ...CHRYSANTHEMUM_PRESET, name: "v4正本" });
    values.set(
      STORAGE_KEY_V3,
      JSON.stringify({ version: 3, designs: [{ id: "broken-v3" }] }),
    );

    expect(new DesignRepository(storage).list()[0]?.name).toBe("v4正本");
    expect(new DesignRepository(storage).listIntents()[0]?.schemaVersion).toBe(
      4,
    );
  });

  it("falls back to retained v3 without overwriting a damaged v4 envelope", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    const sourceRepository = new DesignRepository(storage, () => "source");
    const v3Source = sourceRepository.save(CHRYSANTHEMUM_PRESET);
    values.set(
      STORAGE_KEY_V3,
      JSON.stringify({ version: 3, designs: [v3Source] }),
    );
    const validV3 = values.get(STORAGE_KEY_V3);
    expect(validV3).toBeDefined();
    const damagedV4 = JSON.stringify({
      version: 4,
      designs: [{ id: "broken-v4" }],
    });
    values.set(STORAGE_KEY_V4, damagedV4);

    const repository = new DesignRepository(storage);
    expect(repository.list()[0]?.id).toBe("custom-source");
    expect(repository.migrationWarning).toContain("v4保存作品");
    expect(values.get(STORAGE_KEY_V4)).toBe(damagedV4);
  });
});
