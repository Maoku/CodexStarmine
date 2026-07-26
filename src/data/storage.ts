import { compileFireworkDesign } from "../core/burst/compiler";
import type {
  AnyFireworkDesign,
  FireworkDesign,
  FireworkDesignV1,
  FireworkDesignV2,
  FireworkDesignV3,
  FireworkDesignV4,
} from "./firework";
import {
  isFireworkDesignV2,
  isFireworkDesignV3,
  isFireworkDesignV4,
  normalizeLayerEffectTiming,
  normalizeVirtualStarEffectProfile,
} from "./firework";
import { isFireworkDesignV1, migrateV1ToV2 } from "./migrations/v1ToV2";
import {
  migrateV2ToV3,
  restoreLegacyV2Design,
  V2_TO_V3_REGRESSION_SEED,
} from "./migrations/v2ToV3";
import {
  ensureFireworkDesignV4,
  migrateV3ToV4,
  resolveFireworkDesignV4,
  V3_TO_V4_REGRESSION_SEED,
} from "./migrations/v3ToV4";

export const STORAGE_KEY_V1 = "codex-starmine.designs.v1";
export const STORAGE_KEY_V2 = "codex-starmine.designs.v2";
export const STORAGE_KEY_V3 = "codex-starmine.designs.v3";
export const STORAGE_KEY_V4 = "codex-starmine.designs.v4";
export const STORAGE_METADATA_KEY_V1 = "codex-starmine.designs.metadata.v1";
export const FIREWORK_LIBRARY_EXPORT_FORMAT = "codex-starmine.firework-library";

export interface StorageLike {
  getItem: (key: string) => string | null;
  removeItem?: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

export interface DesignLibraryEntry {
  readonly design: FireworkDesignV3;
  readonly updatedAt: string;
}

export interface FireworkLibraryExportEntry {
  readonly design: FireworkDesignV4;
  readonly updatedAt: string;
}

export interface FireworkLibraryExportV1 {
  readonly exportedAt: string;
  readonly fireworks: readonly FireworkLibraryExportEntry[];
  readonly format: typeof FIREWORK_LIBRARY_EXPORT_FORMAT;
  readonly version: 1;
}

export interface FireworkLibraryImportResult {
  readonly added: number;
  readonly replaced: number;
  readonly skipped: number;
}

export interface FireworkLibraryImportPreview {
  readonly added: number;
  readonly conflicts: number;
}

interface StoredLibraryV1 {
  designs: FireworkDesignV1[];
  version: 1;
}

/** Frozen schema v2 storage envelope retained for non-destructive migration. */
export interface StoredLibraryV2 {
  readonly designs: readonly FireworkDesignV2[];
  readonly version: 2;
}

export interface StoredLibraryV3 {
  readonly designs: readonly FireworkDesignV3[];
  readonly version: 3;
}

export interface StoredLibraryV4 {
  readonly designs: readonly FireworkDesignV4[];
  readonly version: 4;
}

interface StoredDesignMetadataV1 {
  readonly updatedAtById: Readonly<Record<string, string>>;
  readonly version: 1;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeOptionalEffects(designs: unknown[]): void {
  for (const designValue of designs) {
    if (!designValue || typeof designValue !== "object") continue;
    const design = designValue as Record<string, unknown>;
    if (
      design.starDefinitions &&
      typeof design.starDefinitions === "object" &&
      !Array.isArray(design.starDefinitions)
    ) {
      for (const starValue of Object.values(
        design.starDefinitions as Record<string, unknown>,
      )) {
        if (!starValue || typeof starValue !== "object") continue;
        const star = starValue as Record<string, unknown>;
        if (star.effectProfile === undefined) continue;
        const normalized = normalizeVirtualStarEffectProfile(
          star.effectProfile,
        );
        if (normalized) star.effectProfile = normalized;
        else delete star.effectProfile;
      }
    }
    if (!Array.isArray(design.layers)) continue;
    for (const layerValue of design.layers) {
      if (!layerValue || typeof layerValue !== "object") continue;
      const layer = layerValue as Record<string, unknown>;
      if (layer.effectTiming !== undefined) {
        const normalized = normalizeLayerEffectTiming(layer.effectTiming);
        if (normalized) layer.effectTiming = normalized;
        else delete layer.effectTiming;
      }
      if (Array.isArray(layer.points)) {
        for (const pointValue of layer.points) {
          if (!pointValue || typeof pointValue !== "object") continue;
          const point = pointValue as Record<string, unknown>;
          if (point.effectPhase === undefined) continue;
          point.effectPhase =
            typeof point.effectPhase === "number" &&
            Number.isFinite(point.effectPhase)
              ? Math.min(Math.max(point.effectPhase, 0), 1)
              : 0;
        }
      }
    }
  }
}

function defaultId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function defaultNow(): Date {
  return new Date();
}

function isValidUpdatedAt(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseFireworkLibraryExport(
  raw: string,
): FireworkLibraryExportV1 {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("JSONファイルを読み取れませんでした。");
  }
  if (!value || typeof value !== "object") {
    throw new Error("花火玉ライブラリの形式ではありません。");
  }
  const payload = value as Partial<FireworkLibraryExportV1>;
  if (
    payload.format !== FIREWORK_LIBRARY_EXPORT_FORMAT ||
    payload.version !== 1 ||
    !isValidUpdatedAt(payload.exportedAt) ||
    !Array.isArray(payload.fireworks)
  ) {
    throw new Error("対応していない花火玉ライブラリ形式です。");
  }

  const ids = new Set<string>();
  for (const entry of payload.fireworks) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !isValidUpdatedAt(entry.updatedAt) ||
      !isFireworkDesignV4(entry.design) ||
      !entry.design.id.startsWith("custom-")
    ) {
      throw new Error("花火玉データに破損または未対応の項目があります。");
    }
    if (ids.has(entry.design.id)) {
      throw new Error("同じIDの花火玉がファイル内で重複しています。");
    }
    ids.add(entry.design.id);
  }
  return clone(payload as FireworkLibraryExportV1);
}

function plansMatchV2(
  left: FireworkDesignV2,
  right: FireworkDesignV2,
): boolean {
  return (
    JSON.stringify(compileFireworkDesign(left, V2_TO_V3_REGRESSION_SEED)) ===
    JSON.stringify(compileFireworkDesign(right, V2_TO_V3_REGRESSION_SEED))
  );
}

function plansMatchV3(
  left: FireworkDesignV3,
  right: FireworkDesignV4,
): boolean {
  return (
    JSON.stringify(compileFireworkDesign(left, V3_TO_V4_REGRESSION_SEED)) ===
    JSON.stringify(compileFireworkDesign(right, V3_TO_V4_REGRESSION_SEED))
  );
}

/**
 * Storage is v4-first. `list` and `find` keep returning a resolved v3 view
 * until the editor switches to authoring intents in the following phases.
 */
export class DesignRepository {
  readonly #idFactory: () => string;
  readonly #now: () => Date;
  readonly #storage?: StorageLike;
  #fallback: FireworkDesignV4[] = [];
  #fallbackUpdatedAtById: Record<string, string> = {};
  #migrationWarning: string | undefined;

  constructor(
    storage?: StorageLike,
    idFactory: () => string = defaultId,
    now: () => Date = defaultNow,
  ) {
    this.#storage = storage;
    this.#idFactory = idFactory;
    this.#now = now;
  }

  get migrationWarning(): string | undefined {
    this.#read();
    return this.#migrationWarning;
  }

  list(): FireworkDesignV3[] {
    return this.#read().map(resolveFireworkDesignV4);
  }

  listIntents(): FireworkDesignV4[] {
    return this.#read().map(clone);
  }

  listEntries(): DesignLibraryEntry[] {
    const designs = this.list();
    const updatedAtById = this.#readUpdatedAtById(
      designs.map((design) => design.id),
    );
    return designs.map((design) => ({
      design,
      updatedAt: updatedAtById[design.id],
    }));
  }

  find(id: string): FireworkDesignV3 | undefined {
    const design = this.findIntent(id);
    return design ? resolveFireworkDesignV4(design) : undefined;
  }

  findIntent(id: string): FireworkDesignV4 | undefined {
    const design = this.#read().find((candidate) => candidate.id === id);
    return design ? clone(design) : undefined;
  }

  save(design: FireworkDesign, asCopy = false): FireworkDesignV3 {
    return resolveFireworkDesignV4(this.saveIntent(design, asCopy));
  }

  saveIntent(design: AnyFireworkDesign, asCopy = false): FireworkDesignV4 {
    const designs = this.#read();
    const updatedAtById = this.#readUpdatedAtById(
      designs.map((candidate) => candidate.id),
    );
    const isExistingCustom =
      design.id.startsWith("custom-") &&
      designs.some((candidate) => candidate.id === design.id);
    const editable = ensureFireworkDesignV4(design);
    const saved = clone({
      ...editable,
      id:
        !asCopy && isExistingCustom
          ? design.id
          : this.#createUniqueCustomId(designs),
      name: asCopy
        ? `${design.name} の複製`
        : design.name.trim() || "無題の花火",
    });
    const existingIndex = designs.findIndex(
      (candidate) => candidate.id === saved.id,
    );
    if (existingIndex >= 0) designs.splice(existingIndex, 1);
    designs.unshift(saved);
    this.#writeV4(designs);
    updatedAtById[saved.id] = this.#nowISOString();
    this.#writeUpdatedAtById(
      updatedAtById,
      designs.map((candidate) => candidate.id),
    );
    return clone(saved);
  }

  exportLibrary(): FireworkLibraryExportV1 {
    const designs = this.listIntents();
    const updatedAtById = this.#readUpdatedAtById(
      designs.map((design) => design.id),
    );
    return {
      exportedAt: this.#nowISOString(),
      fireworks: designs.map((design) => ({
        design,
        updatedAt: updatedAtById[design.id],
      })),
      format: FIREWORK_LIBRARY_EXPORT_FORMAT,
      version: 1,
    };
  }

  exportLibraryJSON(): string {
    return JSON.stringify(this.exportLibrary(), null, 2);
  }

  previewLibraryImportJSON(raw: string): FireworkLibraryImportPreview {
    const payload = parseFireworkLibraryExport(raw);
    const existingIds = new Set(this.#read().map((design) => design.id));
    const conflicts = payload.fireworks.filter((entry) =>
      existingIds.has(entry.design.id),
    ).length;
    return {
      added: payload.fireworks.length - conflicts,
      conflicts,
    };
  }

  importLibraryJSON(
    raw: string,
    replaceConflicts = false,
  ): FireworkLibraryImportResult {
    const payload = parseFireworkLibraryExport(raw);
    const existing = this.#read();
    const updatedAtById = this.#readUpdatedAtById(
      existing.map((design) => design.id),
    );
    const byId = new Map(existing.map((design) => [design.id, design]));
    const changedIds: string[] = [];
    let added = 0;
    let replaced = 0;
    let skipped = 0;

    for (const entry of payload.fireworks) {
      const id = entry.design.id;
      const current = byId.get(id);
      if (!current) {
        byId.set(id, clone(entry.design));
        updatedAtById[id] = new Date(entry.updatedAt).toISOString();
        changedIds.push(id);
        added += 1;
        continue;
      }
      if (!replaceConflicts) {
        skipped += 1;
        continue;
      }
      byId.set(id, clone(entry.design));
      updatedAtById[id] = new Date(entry.updatedAt).toISOString();
      changedIds.push(id);
      replaced += 1;
    }

    if (changedIds.length > 0) {
      const changedIdSet = new Set(changedIds);
      const merged = [
        ...changedIds.map((id) => byId.get(id)).filter(Boolean),
        ...existing.filter((design) => !changedIdSet.has(design.id)),
      ] as FireworkDesignV4[];
      this.#writeV4(merged);
      this.#writeUpdatedAtById(
        updatedAtById,
        merged.map((design) => design.id),
      );
    }

    return { added, replaced, skipped };
  }

  duplicate(id: string): FireworkDesignV3 | undefined {
    const source = this.findIntent(id);
    return source
      ? resolveFireworkDesignV4(this.saveIntent(source, true))
      : undefined;
  }

  remove(id: string): boolean {
    const designs = this.#read();
    const updatedAtById = this.#readUpdatedAtById(
      designs.map((design) => design.id),
    );
    const filtered = designs.filter((design) => design.id !== id);
    if (filtered.length === designs.length) return false;
    this.#writeV4(filtered);
    delete updatedAtById[id];
    this.#writeUpdatedAtById(
      updatedAtById,
      filtered.map((design) => design.id),
    );
    return true;
  }

  clear(): number {
    const count = this.#read().length;
    this.#fallback = [];
    this.#fallbackUpdatedAtById = {};
    this.#migrationWarning = undefined;
    if (!this.#storage) return count;

    const keys = [
      STORAGE_KEY_V1,
      STORAGE_KEY_V2,
      STORAGE_KEY_V3,
      STORAGE_KEY_V4,
      STORAGE_METADATA_KEY_V1,
    ];
    try {
      if (this.#storage.removeItem) {
        keys.forEach((key) => this.#storage?.removeItem?.(key));
      } else {
        this.#storage.setItem(
          STORAGE_KEY_V1,
          JSON.stringify({ version: 1, designs: [] }),
        );
        this.#storage.setItem(
          STORAGE_KEY_V2,
          JSON.stringify({ version: 2, designs: [] }),
        );
        this.#storage.setItem(
          STORAGE_KEY_V3,
          JSON.stringify({ version: 3, designs: [] }),
        );
        this.#storage.setItem(
          STORAGE_KEY_V4,
          JSON.stringify({ version: 4, designs: [] }),
        );
        this.#storage.setItem(
          STORAGE_METADATA_KEY_V1,
          JSON.stringify({ version: 1, updatedAtById: {} }),
        );
      }
    } catch {
      this.#migrationWarning = "保存領域から作品を消去できませんでした。";
    }
    return count;
  }

  #createUniqueCustomId(designs: readonly FireworkDesignV4[]): string {
    const ids = new Set(designs.map((design) => design.id));
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const suffix = this.#idFactory().trim();
      if (!suffix) continue;
      const id = `custom-${suffix}`;
      if (!ids.has(id)) return id;
    }
    throw new Error("花火玉のユニークIDを生成できませんでした。");
  }

  #nowISOString(): string {
    const value = this.#now();
    return Number.isFinite(value.getTime())
      ? value.toISOString()
      : new Date().toISOString();
  }

  #readUpdatedAtById(designIds: readonly string[]): Record<string, string> {
    const validIds = new Set(designIds);
    let source: Record<string, string> = {
      ...this.#fallbackUpdatedAtById,
    };
    let changed = false;

    if (this.#storage) {
      try {
        const raw = this.#storage.getItem(STORAGE_METADATA_KEY_V1);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<StoredDesignMetadataV1>;
          if (
            parsed.version === 1 &&
            parsed.updatedAtById &&
            typeof parsed.updatedAtById === "object"
          ) {
            source = { ...parsed.updatedAtById };
          } else {
            changed = true;
          }
        } else {
          changed = designIds.length > 0;
        }
      } catch {
        source = {};
        changed = true;
      }
    }

    const updatedAtById: Record<string, string> = {};
    const fallbackUpdatedAt = this.#nowISOString();
    for (const id of validIds) {
      const value = source[id];
      if (isValidUpdatedAt(value)) {
        updatedAtById[id] = new Date(value).toISOString();
      } else {
        updatedAtById[id] = fallbackUpdatedAt;
        changed = true;
      }
    }
    if (Object.keys(source).some((id) => !validIds.has(id))) changed = true;

    this.#fallbackUpdatedAtById = { ...updatedAtById };
    if (changed) this.#writeUpdatedAtById(updatedAtById, designIds);
    return { ...updatedAtById };
  }

  #writeUpdatedAtById(
    source: Readonly<Record<string, string>>,
    designIds: readonly string[],
  ): void {
    const updatedAtById = Object.fromEntries(
      designIds.map((id) => [
        id,
        isValidUpdatedAt(source[id])
          ? new Date(source[id]).toISOString()
          : this.#nowISOString(),
      ]),
    );
    this.#fallbackUpdatedAtById = { ...updatedAtById };
    if (!this.#storage) return;
    try {
      const payload: StoredDesignMetadataV1 = {
        version: 1,
        updatedAtById,
      };
      this.#storage.setItem(STORAGE_METADATA_KEY_V1, JSON.stringify(payload));
    } catch {
      this.#migrationWarning =
        "更新日時を保存できなかったため、このセッションだけで保持します。";
    }
  }

  #parseV4(raw: string): FireworkDesignV4[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV4>;
    if (parsed.version !== 4 || !Array.isArray(parsed.designs))
      return undefined;
    normalizeOptionalEffects(parsed.designs);
    if (!parsed.designs.every(isFireworkDesignV4)) return undefined;
    return parsed.designs.map(clone);
  }

  #parseV3(raw: string): FireworkDesignV3[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV3>;
    if (parsed.version !== 3 || !Array.isArray(parsed.designs))
      return undefined;
    normalizeOptionalEffects(parsed.designs);
    if (!parsed.designs.every(isFireworkDesignV3)) return undefined;
    return parsed.designs.map(clone);
  }

  #parseV2(raw: string): FireworkDesignV2[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV2>;
    if (parsed.version !== 2 || !Array.isArray(parsed.designs))
      return undefined;
    normalizeOptionalEffects(parsed.designs);
    if (!parsed.designs.every(isFireworkDesignV2)) return undefined;
    return parsed.designs.map(clone);
  }

  #migrateV3Designs(
    sources: FireworkDesignV3[],
    persist: boolean,
  ): FireworkDesignV4[] | undefined {
    const migrated = sources.map(migrateV3ToV4);
    const safe = migrated.every(
      (design, index) =>
        isFireworkDesignV4(design) && plansMatchV3(sources[index], design),
    );
    if (!safe) {
      this.#migrationWarning =
        "v3作品の固定seed比較に失敗したため、v4へ書き込まず元データを保持しました。";
      return undefined;
    }
    if (persist) this.#writeV4(migrated);
    else this.#fallback = migrated.map(clone);
    return migrated;
  }

  #migrateV3(raw: string, persist: boolean): FireworkDesignV4[] | undefined {
    const sources = this.#parseV3(raw);
    if (!sources) {
      this.#migrationWarning =
        "v3作品に破損があるため、v4へ自動移行せず元データを保持しました。";
      return undefined;
    }
    return this.#migrateV3Designs(sources, persist);
  }

  #migrateV2(raw: string, persist: boolean): FireworkDesignV4[] | undefined {
    const sources = this.#parseV2(raw);
    if (!sources) {
      this.#migrationWarning =
        "v2作品に破損があるため、v4へ自動移行せず元データを保持しました。";
      return undefined;
    }
    const v3 = sources.map(migrateV2ToV3);
    const safe = v3.every((design, index) => {
      if (!isFireworkDesignV3(design)) return false;
      const restored = restoreLegacyV2Design(design);
      return Boolean(restored && plansMatchV2(sources[index], restored));
    });
    if (!safe) {
      this.#migrationWarning =
        "v2作品の固定seed比較に失敗したため、v3/v4へ書き込まず元データを保持しました。";
      return undefined;
    }
    if (persist) this.#writeV3(v3);
    return this.#migrateV3Designs(v3, persist);
  }

  #migrateV1(raw: string): FireworkDesignV4[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV1>;
    if (parsed.version !== 1 || !Array.isArray(parsed.designs))
      return undefined;
    if (!parsed.designs.every(isFireworkDesignV1)) {
      this.#migrationWarning =
        "旧形式の作品に破損があるため、自動移行せず元データを保持しました。";
      return undefined;
    }
    const v2 = parsed.designs.map(migrateV1ToV2);
    if (!v2.every(isFireworkDesignV2)) return undefined;
    this.#writeV2(v2);
    return this.#migrateV2(
      JSON.stringify({ version: 2, designs: v2 } satisfies StoredLibraryV2),
      true,
    );
  }

  #read(): FireworkDesignV4[] {
    if (!this.#storage) return this.#fallback.map(clone);
    try {
      const v4 = this.#storage.getItem(STORAGE_KEY_V4);
      if (v4) {
        const designs = this.#parseV4(v4);
        if (designs) return designs;
        this.#migrationWarning =
          "v4保存作品を検証できなかったため、v3の安全な控えを使用します。";
        const v3Fallback = this.#storage.getItem(STORAGE_KEY_V3);
        if (v3Fallback) {
          const migrated = this.#migrateV3(v3Fallback, false);
          if (migrated) return migrated;
        }
        const v2Fallback = this.#storage.getItem(STORAGE_KEY_V2);
        if (v2Fallback) {
          return (
            this.#migrateV2(v2Fallback, false) ?? this.#fallback.map(clone)
          );
        }
        return this.#fallback.map(clone);
      }
      const v3 = this.#storage.getItem(STORAGE_KEY_V3);
      if (v3) {
        const migrated = this.#migrateV3(v3, true);
        if (migrated) return migrated;
        const v2Fallback = this.#storage.getItem(STORAGE_KEY_V2);
        if (v2Fallback) {
          return (
            this.#migrateV2(v2Fallback, false) ?? this.#fallback.map(clone)
          );
        }
        return this.#fallback.map(clone);
      }
      const v2 = this.#storage.getItem(STORAGE_KEY_V2);
      if (v2) {
        return this.#migrateV2(v2, true) ?? this.#fallback.map(clone);
      }
      const v1 = this.#storage.getItem(STORAGE_KEY_V1);
      if (!v1) return [];
      return this.#migrateV1(v1) ?? this.#fallback.map(clone);
    } catch {
      this.#migrationWarning =
        "保存領域を読み込めなかったため、このセッションだけで編集します。";
      return this.#fallback.map(clone);
    }
  }

  #writeV2(designs: FireworkDesignV2[]): void {
    if (!this.#storage) return;
    const payload: StoredLibraryV2 = { version: 2, designs };
    this.#storage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
  }

  #writeV3(designs: FireworkDesignV3[]): void {
    if (!this.#storage) return;
    const payload: StoredLibraryV3 = { version: 3, designs };
    this.#storage.setItem(STORAGE_KEY_V3, JSON.stringify(payload));
  }

  #writeV4(designs: FireworkDesignV4[]): void {
    this.#fallback = designs.map(clone);
    if (!this.#storage) return;
    try {
      const payload: StoredLibraryV4 = { version: 4, designs };
      this.#storage.setItem(STORAGE_KEY_V4, JSON.stringify(payload));
    } catch {
      this.#migrationWarning =
        "保存領域へ書き込めなかったため、このセッションだけ作品を保持します。";
    }
  }
}
