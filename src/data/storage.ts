import { compileFireworkDesign } from "../core/burst/compiler";
import type {
  FireworkDesign,
  FireworkDesignV1,
  FireworkDesignV2,
  FireworkDesignV3,
} from "./firework";
import { isFireworkDesignV2, isFireworkDesignV3 } from "./firework";
import { isFireworkDesignV1, migrateV1ToV2 } from "./migrations/v1ToV2";
import {
  ensureFireworkDesignV3,
  migrateV2ToV3,
  restoreLegacyV2Design,
  V2_TO_V3_REGRESSION_SEED,
} from "./migrations/v2ToV3";

export const STORAGE_KEY_V1 = "codex-starmine.designs.v1";
export const STORAGE_KEY_V2 = "codex-starmine.designs.v2";
export const STORAGE_KEY_V3 = "codex-starmine.designs.v3";

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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function defaultId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function plansMatch(left: FireworkDesignV2, right: FireworkDesignV2): boolean {
  return (
    JSON.stringify(compileFireworkDesign(left, V2_TO_V3_REGRESSION_SEED)) ===
    JSON.stringify(compileFireworkDesign(right, V2_TO_V3_REGRESSION_SEED))
  );
}

export class DesignRepository {
  readonly #idFactory: () => string;
  readonly #storage?: StorageLike;
  #fallback: FireworkDesignV3[] = [];
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
    return this.#read().map(clone);
  }

  find(id: string): FireworkDesignV3 | undefined {
    const design = this.#read().find((candidate) => candidate.id === id);
    return design ? clone(design) : undefined;
  }

  save(design: FireworkDesign, asCopy = false): FireworkDesignV3 {
    const designs = this.#read();
    const isExistingCustom =
      design.id.startsWith("custom-") &&
      designs.some((candidate) => candidate.id === design.id);
    const editable = ensureFireworkDesignV3(design);
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
    this.#writeV3(designs);
    return clone(saved);
  }

  duplicate(id: string): FireworkDesignV3 | undefined {
    const source = this.find(id);
    return source ? this.save(source, true) : undefined;
  }

  remove(id: string): boolean {
    const designs = this.#read();
    const filtered = designs.filter((design) => design.id !== id);
    if (filtered.length === designs.length) return false;
    this.#writeV3(filtered);
    return true;
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

  #migrateV2(raw: string, persist: boolean): FireworkDesignV3[] | undefined {
    const sources = this.#parseV2(raw);
    if (!sources) {
      this.#migrationWarning =
        "v2作品に破損があるため、v3へ自動移行せず元データを保持しました。";
      return undefined;
    }
    const migrated = sources.map(migrateV2ToV3);
    const safe = migrated.every((design, index) => {
      if (!isFireworkDesignV3(design)) return false;
      const restored = restoreLegacyV2Design(design);
      return Boolean(restored && plansMatch(sources[index], restored));
    });
    if (!safe) {
      this.#migrationWarning =
        "v2作品の固定seed比較に失敗したため、v3へ書き込まず元データを保持しました。";
      return undefined;
    }
    if (persist) this.#writeV3(migrated);
    else this.#fallback = migrated.map(clone);
    return migrated;
  }

  #migrateV1(raw: string): FireworkDesignV3[] | undefined {
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

  #read(): FireworkDesignV3[] {
    if (!this.#storage) return this.#fallback.map(clone);
    try {
      const v3 = this.#storage.getItem(STORAGE_KEY_V3);
      if (v3) {
        const designs = this.#parseV3(v3);
        if (designs) return designs;
        this.#migrationWarning =
          "v3保存作品を検証できなかったため、v2の安全な控えを使用します。";
        const v2Fallback = this.#storage.getItem(STORAGE_KEY_V2);
        return v2Fallback
          ? (this.#migrateV2(v2Fallback, false) ?? this.#fallback.map(clone))
          : this.#fallback.map(clone);
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
    this.#fallback = designs.map(clone);
    if (!this.#storage) return;
    try {
      const payload: StoredLibraryV3 = { version: 3, designs };
      this.#storage.setItem(STORAGE_KEY_V3, JSON.stringify(payload));
    } catch {
      this.#migrationWarning =
        "保存領域へ書き込めなかったため、このセッションだけ作品を保持します。";
    }
  }
}
