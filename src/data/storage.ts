import type { FireworkDesign } from "./firework";

const STORAGE_KEY = "codex-starmine.designs.v1";

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface StoredLibrary {
  designs: FireworkDesign[];
  version: 1;
}

function cloneDesign(design: FireworkDesign): FireworkDesign {
  return structuredClone(design);
}

function isFireworkDesign(value: unknown): value is FireworkDesign {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FireworkDesign>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.pattern === "string" &&
    typeof candidate.sizeClass === "string" &&
    typeof candidate.particleDensity === "number" &&
    Array.isArray(candidate.colorStages) &&
    Array.isArray(candidate.coreLayers) &&
    Array.isArray(candidate.childBursts)
  );
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

  constructor(storage?: StorageLike, idFactory: () => string = defaultId) {
    this.#storage = storage;
    this.#idFactory = idFactory;
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

  #read(): FireworkDesign[] {
    if (!this.#storage) return this.#fallback.map(cloneDesign);
    try {
      const raw = this.#storage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Partial<StoredLibrary>;
      if (parsed.version !== 1 || !Array.isArray(parsed.designs)) return [];
      return parsed.designs.filter(isFireworkDesign).map(cloneDesign);
    } catch {
      return this.#fallback.map(cloneDesign);
    }
  }

  #write(designs: FireworkDesign[]): void {
    this.#fallback = designs.map(cloneDesign);
    if (!this.#storage) return;
    try {
      const payload: StoredLibrary = { version: 1, designs };
      this.#storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Private browsing or exhausted storage still keeps this session usable.
    }
  }
}
