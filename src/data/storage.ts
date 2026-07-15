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

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defaultId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
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
  readonly #storage?: StorageLike;
  #fallback: FireworkDesignV4[] = [];
  #migrationWarning: string | undefined;

  constructor(storage?: StorageLike, idFactory: () => string = defaultId) {
    this.#storage = storage;
    this.#idFactory = idFactory;
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
    const isExistingCustom =
      design.id.startsWith("custom-") &&
      designs.some((candidate) => candidate.id === design.id);
    const editable = ensureFireworkDesignV4(design);
    const saved = clone({
      ...editable,
      id:
        !asCopy && isExistingCustom ? design.id : `custom-${this.#idFactory()}`,
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
    return clone(saved);
  }

  duplicate(id: string): FireworkDesignV3 | undefined {
    const source = this.findIntent(id);
    return source
      ? resolveFireworkDesignV4(this.saveIntent(source, true))
      : undefined;
  }

  remove(id: string): boolean {
    const designs = this.#read();
    const filtered = designs.filter((design) => design.id !== id);
    if (filtered.length === designs.length) return false;
    this.#writeV4(filtered);
    return true;
  }

  #parseV4(raw: string): FireworkDesignV4[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV4>;
    if (parsed.version !== 4 || !Array.isArray(parsed.designs))
      return undefined;
    if (!parsed.designs.every(isFireworkDesignV4)) return undefined;
    return parsed.designs.map(clone);
  }

  #parseV3(raw: string): FireworkDesignV3[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV3>;
    if (parsed.version !== 3 || !Array.isArray(parsed.designs))
      return undefined;
    if (!parsed.designs.every(isFireworkDesignV3)) return undefined;
    return parsed.designs.map(clone);
  }

  #parseV2(raw: string): FireworkDesignV2[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV2>;
    if (parsed.version !== 2 || !Array.isArray(parsed.designs))
      return undefined;
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
