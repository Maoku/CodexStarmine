import type {
  ChildBurstLayer,
  FireworkDesign,
  FireworkLayer,
  SphericalStarLayer,
} from "../../data";
import {
  buildEditorDiagnostic,
  type EditorDiagnostic,
} from "./CraftDiagnosticController";

export interface CraftSelection {
  layerId?: string;
  starDefinitionId?: string;
}

interface HistoryEntry {
  design: FireworkDesign;
  label: string;
}

export interface CraftDocumentSnapshot {
  canRedo: boolean;
  canUndo: boolean;
  diagnostic: EditorDiagnostic;
  dirty: boolean;
  draft: FireworkDesign;
  selection: CraftSelection;
}

type Listener = (snapshot: CraftDocumentSnapshot) => void;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function syncCompatibilityFields(design: FireworkDesign): void {
  const outer = design.layers.find(
    (layer) =>
      layer.kind === "spherical" ||
      layer.kind === "pattern" ||
      layer.kind === "branch",
  );
  if (outer) {
    const definition = design.starDefinitions[outer.defaultStarId];
    if (definition) {
      design.colorStages = clone(definition.colorStages);
      design.burnDuration = definition.burnDuration;
      design.drag = definition.drag;
      design.gravityScale = definition.gravityScale;
      design.trailStyle = {
        length: definition.trailLifetime,
        sparkle: definition.flicker,
        width: definition.trailWidth,
      };
    }
    design.particleDensity =
      outer.kind === "spherical"
        ? outer.count
        : outer.kind === "pattern"
          ? outer.points.length
          : outer.branchCount * outer.starsPerBranch;
  }
  design.coreLayers = design.layers
    .filter(
      (layer): layer is SphericalStarLayer =>
        layer.kind === "spherical" && layer.id !== outer?.id,
    )
    .slice(0, 2)
    .map((layer) => ({
      color:
        design.starDefinitions[layer.defaultStarId]?.colorStages[1]?.color ??
        design.starDefinitions[layer.defaultStarId]?.colorStages[0]?.color ??
        0xffffff,
      radius: layer.radius,
    }));
  design.childBursts = design.layers
    .filter((layer): layer is ChildBurstLayer => layer.kind === "child")
    .map((layer) => ({
      count: layer.count,
      delay: layer.delay,
      radius: 22 * layer.radialSpeedScale,
    }));
  design.burstShape = design.layers.some((layer) => layer.kind === "pattern")
    ? "heart"
    : design.layers.some((layer) => layer.kind === "branch")
      ? "palm"
      : design.layers.some((layer) => layer.kind === "child")
        ? "children"
        : "sphere";
  design.burstVelocity = design.burstField.baseVelocity;
  design.windResponse = design.burstField.windResponse;
  design.symmetry = Math.max(0.7, 1 - design.realism.placementJitter);
}

export class CraftDocumentStore {
  #draft: FireworkDesign;
  #listeners = new Set<Listener>();
  #past: HistoryEntry[] = [];
  #future: HistoryEntry[] = [];
  #selection: CraftSelection = {};
  #savedJSON?: string;
  #snapshotA?: EditorDiagnostic;
  #snapshotB?: EditorDiagnostic;

  constructor(design: FireworkDesign) {
    this.#draft = clone(design);
    this.#selection.layerId = this.#draft.layers[0]?.id;
    this.#savedJSON = JSON.stringify(this.#draft);
  }

  get draft(): FireworkDesign {
    return clone(this.#draft);
  }

  get selectedLayer(): FireworkLayer | undefined {
    const layer = this.#draft.layers.find(
      (candidate) => candidate.id === this.#selection.layerId,
    );
    return layer ? clone(layer) : undefined;
  }

  get snapshots(): { a?: EditorDiagnostic; b?: EditorDiagnostic } {
    return { a: clone(this.#snapshotA), b: clone(this.#snapshotB) };
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#createSnapshot());
    return () => this.#listeners.delete(listener);
  }

  replace(design: FireworkDesign, options: { unsaved?: boolean } = {}): void {
    this.#draft = clone(design);
    this.#past = [];
    this.#future = [];
    this.#selection = { layerId: this.#draft.layers[0]?.id };
    this.#savedJSON = options.unsaved ? undefined : JSON.stringify(this.#draft);
    this.#snapshotA = undefined;
    this.#snapshotB = undefined;
    this.#emit();
  }

  update(label: string, recipe: (draft: FireworkDesign) => void): void {
    const before = clone(this.#draft);
    recipe(this.#draft);
    syncCompatibilityFields(this.#draft);
    if (JSON.stringify(before) === JSON.stringify(this.#draft)) return;
    this.#past.push({ design: before, label });
    if (this.#past.length > 100) this.#past.shift();
    this.#future = [];
    this.#emit();
  }

  undo(): void {
    const entry = this.#past.pop();
    if (!entry) return;
    this.#future.push({ design: clone(this.#draft), label: entry.label });
    this.#draft = entry.design;
    this.#ensureSelection();
    this.#emit();
  }

  redo(): void {
    const entry = this.#future.pop();
    if (!entry) return;
    this.#past.push({ design: clone(this.#draft), label: entry.label });
    this.#draft = entry.design;
    this.#ensureSelection();
    this.#emit();
  }

  selectLayer(layerId: string): void {
    if (!this.#draft.layers.some((layer) => layer.id === layerId)) return;
    this.#selection.layerId = layerId;
    this.#emit();
  }

  selectStarDefinition(starDefinitionId: string): void {
    if (!this.#draft.starDefinitions[starDefinitionId]) return;
    this.#selection.starDefinitionId = starDefinitionId;
    this.#emit();
  }

  markSaved(saved: FireworkDesign): void {
    this.#draft = clone(saved);
    this.#savedJSON = JSON.stringify(this.#draft);
    this.#emit();
  }

  captureSnapshot(slot: "a" | "b"): void {
    const diagnostic = buildEditorDiagnostic(this.#draft);
    if (slot === "a") this.#snapshotA = diagnostic;
    else this.#snapshotB = diagnostic;
    this.#emit();
  }

  #ensureSelection(): void {
    if (
      !this.#draft.layers.some((layer) => layer.id === this.#selection.layerId)
    ) {
      this.#selection.layerId = this.#draft.layers[0]?.id;
    }
  }

  #createSnapshot(): CraftDocumentSnapshot {
    return {
      canRedo: this.#future.length > 0,
      canUndo: this.#past.length > 0,
      diagnostic: buildEditorDiagnostic(this.#draft),
      dirty:
        this.#savedJSON === undefined ||
        JSON.stringify(this.#draft) !== this.#savedJSON,
      draft: clone(this.#draft),
      selection: clone(this.#selection),
    };
  }

  #emit(): void {
    const snapshot = this.#createSnapshot();
    this.#listeners.forEach((listener) => listener(snapshot));
  }
}
