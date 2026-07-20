import { describe, expect, it } from "vitest";

import { ensureFireworkDesignV4 } from "./migrations/v3ToV4";
import { CHRYSANTHEMUM_PRESET } from "./presets";
import {
  DesignRepository,
  FIREWORK_LIBRARY_EXPORT_FORMAT,
  STORAGE_METADATA_KEY_V1,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  STORAGE_KEY_V3,
  STORAGE_KEY_V4,
  type StorageLike,
} from "./storage";

function memoryStorage(values = new Map<string, string>()): StorageLike {
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("DesignRepository", () => {
  it("assigns unique IDs and updates timestamps on every save", () => {
    const ids = ["same", "same", "second"];
    let now = new Date("2026-07-17T01:00:00.000Z");
    const repository = new DesignRepository(
      memoryStorage(),
      () => ids.shift() ?? "fallback",
      () => now,
    );

    const first = repository.save(CHRYSANTHEMUM_PRESET);
    const second = repository.save({
      ...CHRYSANTHEMUM_PRESET,
      name: "別の花火玉",
    });
    expect(first.id).toBe("custom-same");
    expect(second.id).toBe("custom-second");
    expect(repository.listEntries()).toEqual([
      expect.objectContaining({
        design: expect.objectContaining({ id: second.id }),
        updatedAt: "2026-07-17T01:00:00.000Z",
      }),
      expect.objectContaining({
        design: expect.objectContaining({ id: first.id }),
        updatedAt: "2026-07-17T01:00:00.000Z",
      }),
    ]);

    now = new Date("2026-07-17T02:30:00.000Z");
    repository.save({ ...first, name: "更新した花火玉" });
    expect(repository.listEntries()[0]).toMatchObject({
      design: { id: first.id, name: "更新した花火玉" },
      updatedAt: "2026-07-17T02:30:00.000Z",
    });
  });

  it("previews collisions and only replaces them after explicit approval", () => {
    let now = new Date("2026-07-17T03:00:00.000Z");
    const source = new DesignRepository(
      memoryStorage(),
      () => "portable",
      () => now,
    );
    const saved = source.save({
      ...CHRYSANTHEMUM_PRESET,
      name: "持ち運ぶ花火玉",
    });
    const firstJSON = source.exportLibraryJSON();
    expect(JSON.parse(firstJSON)).toMatchObject({
      exportedAt: "2026-07-17T03:00:00.000Z",
      format: FIREWORK_LIBRARY_EXPORT_FORMAT,
      version: 1,
    });

    const target = new DesignRepository(
      memoryStorage(),
      () => "unused",
      () => new Date("2026-07-17T04:00:00.000Z"),
    );
    expect(target.importLibraryJSON(firstJSON)).toEqual({
      added: 1,
      replaced: 0,
      skipped: 0,
    });
    expect(target.previewLibraryImportJSON(firstJSON)).toEqual({
      added: 0,
      conflicts: 1,
    });
    expect(target.importLibraryJSON(firstJSON)).toEqual({
      added: 0,
      replaced: 0,
      skipped: 1,
    });
    expect(target.list()).toHaveLength(1);

    now = new Date("2026-07-17T02:00:00.000Z");
    source.save({ ...saved, name: "JSON側の花火玉" });
    expect(target.importLibraryJSON(source.exportLibraryJSON(), true)).toEqual({
      added: 0,
      replaced: 1,
      skipped: 0,
    });
    expect(target.listEntries()[0]).toMatchObject({
      design: { id: saved.id, name: "JSON側の花火玉" },
      updatedAt: "2026-07-17T02:00:00.000Z",
    });
  });

  it("round trips YZ pattern and manual sections through v4 export", () => {
    const source = new DesignRepository(memoryStorage(), () => "yz-source");
    const design = ensureFireworkDesignV4(CHRYSANTHEMUM_PRESET);
    const defaultStarId = design.layers[0]?.defaultStarId ?? "star-solid-red";
    design.layers = [
      {
        authoringMode: "pattern",
        defaultStarId,
        id: "yz-pattern",
        ignitionOffset: 0,
        locked: false,
        name: "YZ型物",
        pattern: {
          density: 36,
          rotationDegrees: 15,
          scale: 0.7,
          section: { plane: "yz", ratio: 0.3 },
          template: "heart",
        },
        radialSpeedScale: 0.9,
        visible: true,
      },
      {
        authoringMode: "manual",
        defaultStarId,
        id: "yz-manual",
        ignitionOffset: 0,
        locked: false,
        name: "YZ手動",
        points: [
          {
            id: "yz-point",
            position: { x: -0.4, y: 0.25, z: 0.35 },
            section: { plane: "yz", ratio: 0.3 },
            starId: defaultStarId,
          },
        ],
        radialSpeedScale: 1,
        visible: true,
      },
    ];
    source.saveIntent(design);

    const target = new DesignRepository(memoryStorage(), () => "unused");
    expect(target.importLibraryJSON(source.exportLibraryJSON())).toMatchObject({
      added: 1,
    });
    const restored = target.listIntents()[0];
    expect(restored.layers[0]).toMatchObject({
      authoringMode: "pattern",
      pattern: { section: { plane: "yz", ratio: 0.3 } },
    });
    expect(restored.layers[1]).toMatchObject({
      authoringMode: "manual",
      points: [
        {
          position: { x: -0.4, y: 0.25, z: 0.35 },
          section: { plane: "yz", ratio: 0.3 },
        },
      ],
    });
  });

  it("rejects duplicate IDs inside an import file", () => {
    const source = new DesignRepository(memoryStorage(), () => "duplicate");
    source.save(CHRYSANTHEMUM_PRESET);
    const payload = source.exportLibrary();
    const duplicated = JSON.stringify({
      ...payload,
      fireworks: [payload.fireworks[0], payload.fireworks[0]],
    });

    expect(() => source.importLibraryJSON(duplicated)).toThrow("重複");
    expect(source.list()).toHaveLength(1);
  });

  it("clears all persisted firework keys after explicit confirmation", () => {
    const values = new Map<string, string>();
    const repository = new DesignRepository(
      memoryStorage(values),
      () => "clear-me",
    );
    repository.save(CHRYSANTHEMUM_PRESET);
    values.set(STORAGE_KEY_V1, "legacy-v1");
    values.set(STORAGE_KEY_V2, "legacy-v2");
    values.set(STORAGE_KEY_V3, "legacy-v3");

    expect(repository.clear()).toBe(1);
    for (const key of [
      STORAGE_KEY_V1,
      STORAGE_KEY_V2,
      STORAGE_KEY_V3,
      STORAGE_KEY_V4,
      STORAGE_METADATA_KEY_V1,
    ]) {
      expect(values.has(key)).toBe(false);
    }
    expect(repository.list()).toEqual([]);
  });

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
