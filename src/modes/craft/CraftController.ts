import {
  FIREWORK_PRESETS,
  PEONY_PRESET,
  ensureFireworkDesignV3,
  resolveFireworkDesignV4,
  type AscentEffect,
  type DesignRepository,
  type FireworkDesign,
  type FireworkDesignV4,
  type FireworkLibraryImportPreview,
  type FireworkLibraryImportResult,
  type FireworkPattern,
  type SizeClass,
  type SphericalStarLayer,
} from "../../data";
import { CraftDocumentStore } from "./CraftDocumentStore";

export interface CraftShelfLibraryState {
  readonly designs: FireworkDesign[];
  readonly updatedAtById: Readonly<Record<string, string>>;
}

function cloneDesign(design: FireworkDesign): FireworkDesign {
  return structuredClone(design);
}

function dimColor(color: number): number {
  const red = Math.round(((color >> 16) & 0xff) * 0.38);
  const green = Math.round(((color >> 8) & 0xff) * 0.38);
  const blue = Math.round((color & 0xff) * 0.38);
  return (red << 16) | (green << 8) | blue;
}

export class CraftController {
  readonly #presets: FireworkDesign[];
  readonly #repository: DesignRepository;
  readonly document: CraftDocumentStore;

  constructor(
    repository: DesignRepository,
    presets: FireworkDesign[] = FIREWORK_PRESETS,
  ) {
    this.#repository = repository;
    this.#presets = presets;
    this.document = new CraftDocumentStore(
      ensureFireworkDesignV3(cloneDesign(presets[0] ?? PEONY_PRESET)),
    );
  }

  get draft(): FireworkDesign {
    return this.document.draft;
  }

  get intentDraft(): FireworkDesignV4 {
    return this.document.intentDraft;
  }

  get savedDesigns(): FireworkDesign[] {
    return this.#repository.list();
  }

  get shelfDesigns(): FireworkDesign[] {
    return this.shelfLibrary.designs;
  }

  get shelfLibrary(): CraftShelfLibraryState {
    const entries = this.#repository.listEntries();
    return {
      designs: [
        ...entries.map((entry) => entry.design),
        ...this.#presets.map((preset) => cloneDesign(preset)),
      ],
      updatedAtById: Object.fromEntries(
        entries.map((entry) => [entry.design.id, entry.updatedAt]),
      ),
    };
  }

  get migrationWarning(): string | undefined {
    return this.#repository.migrationWarning;
  }

  selectPattern(pattern: FireworkPattern): void {
    const preset = this.#presets.find(
      (candidate) => candidate.pattern === pattern,
    );
    if (!preset) return;
    const sizeClass = this.draft.sizeClass;
    this.document.replace(
      {
        ...ensureFireworkDesignV3(cloneDesign(preset)),
        id: `draft-${pattern}`,
        sizeClass,
      },
      { unsaved: true },
    );
  }

  startBlank(): void {
    this.document.replace(this.#createBlankDesign(), { unsaved: true });
  }

  startNewDraft(
    sizeClass: SizeClass,
    template: "chrysanthemum" | "peony" | "blank",
  ): void {
    const source =
      template === "chrysanthemum"
        ? this.#presets.find(
            (candidate) => candidate.pattern === "chrysanthemum",
          )
        : template === "peony"
          ? this.#presets.find((candidate) => candidate.pattern === "peony")
          : undefined;
    const draft = source
      ? ensureFireworkDesignV3(cloneDesign(source))
      : this.#createBlankDesign();
    draft.id = "draft-new";
    draft.name =
      template === "chrysanthemum"
        ? "新しい菊"
        : template === "peony"
          ? "新しい牡丹"
          : "無題の花火";
    draft.sizeClass = sizeClass;
    this.document.replace(draft, { unsaved: true });
  }

  #createBlankDesign(): FireworkDesign {
    const blank = ensureFireworkDesignV3(cloneDesign(PEONY_PRESET));
    blank.ascentEffect = "none";
    blank.childBursts = [];
    blank.coreLayers = [];
    blank.id = "draft-new";
    blank.name = "無題の花火";
    blank.layers = blank.layers.filter((_, index) => index === 0);
    return blank;
  }

  load(id: string): boolean {
    const design =
      this.#repository.findIntent(id) ??
      this.#presets.find((preset) => preset.id === id);
    if (!design) return false;
    this.document.replace(design);
    return true;
  }

  updateName(name: string): void {
    this.document.updateIntent(
      "作品名を変更",
      (draft) => {
        draft.name = name;
      },
      { preserveLegacy: true },
    );
  }

  updateSize(sizeClass: SizeClass): void {
    this.document.updateIntent(
      "号数を変更",
      (draft) => {
        draft.sizeClass = sizeClass;
      },
      { preserveLegacy: true },
    );
  }

  updateColors(primary: number, secondary: number): void {
    this.document.update("時間配色を変更", (draft) => {
      const outer = draft.layers[0];
      if (!outer || outer.kind === "child") return;
      const definition = draft.starDefinitions[outer.defaultStarId];
      if (!definition) return;
      definition.colorStages = [
        {
          normalizedTime: 0,
          color: 0xffffff,
          intensity: 1.35,
          trailColor: primary,
        },
        {
          normalizedTime: 0.14,
          color: primary,
          intensity: 1.08,
          trailColor: primary,
        },
        {
          normalizedTime: 0.68,
          color: secondary,
          intensity: 0.72,
          trailColor: secondary,
        },
        {
          normalizedTime: 1,
          color: dimColor(secondary),
          intensity: 0,
          trailColor: dimColor(secondary),
        },
      ];
      draft.themeColors = [primary, secondary];
    });
  }

  updateCoreCount(count: number): void {
    this.document.update("芯レイヤー数を変更", (draft) => {
      const target = Math.min(Math.max(Math.round(count), 0), 2);
      const outer = draft.layers.filter(
        (layer) =>
          layer.kind !== "spherical" || !layer.id.startsWith("layer-core"),
      );
      const cores: SphericalStarLayer[] = Array.from(
        { length: target },
        (_, index) => ({
          coloring: { mode: "layer" },
          count: 42 + index * 12,
          defaultStarId: index === 0 ? "star-gold" : "star-change-blue",
          id: `layer-core-${index + 1}`,
          ignitionOffset: 0,
          jitter: 0.01,
          kind: "spherical",
          locked: false,
          missingRate: 0,
          name: `芯 ${index + 1}`,
          overrides: [],
          placement: "fibonacci",
          placementSeed: draft.assemblySeed + 101 + index * 19,
          radialSpeedScale: index === 0 ? 0.38 : 0.66,
          radius: index === 0 ? 0.38 : 0.66,
          visible: true,
        }),
      );
      draft.layers = [outer[0], ...cores, ...outer.slice(1)].filter(Boolean);
    });
  }

  updateTrail(length: number, width: number): void {
    this.document.update("仮想星の尾を変更", (draft) => {
      const outer = draft.layers[0];
      if (!outer || outer.kind === "child") return;
      const definition = draft.starDefinitions[outer.defaultStarId];
      if (!definition) return;
      definition.trailLifetime = Math.min(Math.max(length, 0), 1);
      definition.trailWidth = Math.min(Math.max(width, 0.6), 1.8);
    });
  }

  updateChildCount(count: number): void {
    this.document.update("子花数を変更", (draft) => {
      const safeCount = Math.min(Math.max(Math.round(count), 0), 18);
      draft.layers = draft.layers.filter((layer) => layer.kind !== "child");
      if (safeCount > 0) {
        draft.layers.push({
          count: safeCount,
          defaultStarId: "star-child",
          delay: 0.58,
          id: "layer-child-1",
          ignitionOffset: 0,
          kind: "child",
          locked: false,
          name: "子花 1",
          placement: "sphere",
          radialSpeedScale: 1,
          scale: 0.32,
          visible: true,
          waveDelay: 0.018,
        });
      }
    });
  }

  updateAscentEffect(effect: AscentEffect): void {
    this.document.update("昇曲を変更", (draft) => {
      draft.ascentEffect = effect;
    });
  }

  save(): FireworkDesign {
    const savedIntent = this.#repository.saveIntent(this.intentDraft);
    this.document.markIntentSaved(savedIntent);
    return resolveFireworkDesignV4(savedIntent);
  }

  duplicate(id: string): FireworkDesign | undefined {
    return this.#repository.duplicate(id);
  }

  exportLibraryJSON(): string {
    return this.#repository.exportLibraryJSON();
  }

  previewLibraryImportJSON(raw: string): FireworkLibraryImportPreview {
    return this.#repository.previewLibraryImportJSON(raw);
  }

  importLibraryJSON(
    raw: string,
    replaceConflicts: boolean,
  ): FireworkLibraryImportResult {
    return this.#repository.importLibraryJSON(raw, replaceConflicts);
  }

  clearSavedDesigns(): number {
    const cleared = this.#repository.clear();
    if (this.draft.id.startsWith("custom-")) {
      this.document.replace(this.#createBlankDesign());
    }
    return cleared;
  }

  remove(id: string): boolean {
    const removed = this.#repository.remove(id);
    if (removed && this.draft.id === id) {
      this.document.replace(this.#createBlankDesign());
    }
    return removed;
  }
}
