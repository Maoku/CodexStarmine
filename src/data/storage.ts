import type { FireworkDesign, FireworkDesignV1 } from "./firework";
import { isFireworkDesignV2 } from "./firework";
import { isFireworkDesignV1, migrateV1ToV2 } from "./migrations/v1ToV2";

export const STORAGE_KEY_V1 = "codex-starmine.designs.v1";
export const STORAGE_KEY_V2 = "codex-starmine.designs.v2";

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface StoredLibraryV1 {
  designs: FireworkDesignV1[];
  version: 1;
}

interface StoredLibraryV2 {
  designs: FireworkDesign[];
  version: 2;
}

function cloneDesign(design: FireworkDesign): FireworkDesign {
  return structuredClone(design);
}

function defaultId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

export class DesignRepository {
  readonly #idFactory: () => string;
  readonly #storage?: StorageLike;
  #fallback: FireworkDesign[] = [];
  #migrationWarning: string | undefined;

  constructor(storage?: StorageLike, idFactory: () => string = defaultId) {
    this.#storage = storage;
    this.#idFactory = idFactory;
  }

  get migrationWarning(): string | undefined {
    this.#read();
    return this.#migrationWarning;
  }

  list(): FireworkDesign[] {
    return this.#read().map(cloneDesign);
  }

  find(id: string): FireworkDesign | undefined {
    const design = this.#read().find((candidate) => candidate.id === id);
    return design ? cloneDesign(design) : undefined;
  }

  save(design: FireworkDesign, asCopy = false): FireworkDesign {
    const designs = this.#read();
    const isExistingCustom =
      design.id.startsWith("custom-") &&
      designs.some((candidate) => candidate.id === design.id);
    const saved = cloneDesign({
      ...design,
      id:
        !asCopy && isExistingCustom ? design.id : `custom-${this.#idFactory()}`,
      name: asCopy
        ? `${design.name} の複製`
        : design.name.trim() || "無題の花火",
    });
    const existingIndex = designs.findIndex(
      (candidate) => candidate.id === saved.id,
    );
    if (existingIndex >= 0) {
      designs[existingIndex] = saved;
    } else {
      designs.unshift(saved);
    }
    this.#write(designs);
    return cloneDesign(saved);
  }

  duplicate(id: string): FireworkDesign | undefined {
    const source = this.find(id);
    return source ? this.save(source, true) : undefined;
  }

  remove(id: string): boolean {
    const designs = this.#read();
    const filtered = designs.filter((design) => design.id !== id);
    if (filtered.length === designs.length) return false;
    this.#write(filtered);
    return true;
  }

  #parseV2(raw: string): FireworkDesign[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV2>;
    if (parsed.version !== 2 || !Array.isArray(parsed.designs))
      return undefined;
    if (!parsed.designs.every(isFireworkDesignV2)) return undefined;
    return parsed.designs.map(cloneDesign);
  }

  #migrateV1(raw: string): FireworkDesign[] | undefined {
    const parsed = JSON.parse(raw) as Partial<StoredLibraryV1>;
    if (parsed.version !== 1 || !Array.isArray(parsed.designs))
      return undefined;
    if (!parsed.designs.every(isFireworkDesignV1)) {
      this.#migrationWarning =
        "旧形式の作品に破損があるため、自動移行せず元データを保持しました。";
      return undefined;
    }
    const migrated = parsed.designs.map(migrateV1ToV2);
    if (!migrated.every(isFireworkDesignV2)) return undefined;
    this.#write(migrated);
    return migrated;
  }

  #read(): FireworkDesign[] {
    if (!this.#storage) return this.#fallback.map(cloneDesign);
    try {
      const v2 = this.#storage.getItem(STORAGE_KEY_V2);
      if (v2) {
        const designs = this.#parseV2(v2);
        if (designs) return designs;
        this.#migrationWarning =
          "保存作品を検証できなかったため、このセッションでは安全な控えを使用します。";
        return this.#fallback.map(cloneDesign);
      }
      const v1 = this.#storage.getItem(STORAGE_KEY_V1);
      if (!v1) return [];
      return this.#migrateV1(v1) ?? this.#fallback.map(cloneDesign);
    } catch {
      this.#migrationWarning =
        "保存領域を読み込めなかったため、このセッションだけで編集します。";
      return this.#fallback.map(cloneDesign);
    }
  }

  #write(designs: FireworkDesign[]): void {
    this.#fallback = designs.map(cloneDesign);
    if (!this.#storage) return;
    try {
      const payload: StoredLibraryV2 = { version: 2, designs };
      this.#storage.setItem(STORAGE_KEY_V2, JSON.stringify(payload));
    } catch {
      this.#migrationWarning =
        "保存領域へ書き込めなかったため、このセッションだけ作品を保持します。";
    }
  }
}
