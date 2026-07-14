import {
  FIREWORK_PRESETS,
  PEONY_PRESET,
  type AscentEffect,
  type FireworkDesign,
  type FireworkPattern,
  type SizeClass,
  type DesignRepository,
} from "../../data";

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
  #draft: FireworkDesign;

  constructor(
    repository: DesignRepository,
    presets: FireworkDesign[] = FIREWORK_PRESETS,
  ) {
    this.#repository = repository;
    this.#presets = presets;
    this.#draft = cloneDesign(presets[0] ?? PEONY_PRESET);
  }

  get draft(): FireworkDesign {
    return cloneDesign(this.#draft);
  }

  get savedDesigns(): FireworkDesign[] {
    return this.#repository.list();
  }

  selectPattern(pattern: FireworkPattern): void {
    const preset = this.#presets.find(
      (candidate) => candidate.pattern === pattern,
    );
    if (!preset) return;
    const sizeClass = this.#draft.sizeClass;
    this.#draft = {
      ...cloneDesign(preset),
      id: `draft-${pattern}`,
      sizeClass,
    };
  }

  startBlank(): void {
    this.#draft = {
      ...cloneDesign(PEONY_PRESET),
      ascentEffect: "none",
      childBursts: [],
      coreLayers: [],
      id: "draft-new",
      name: "無題の花火",
    };
  }

  load(id: string): boolean {
    const design = this.#repository.find(id);
    if (!design) return false;
    this.#draft = design;
    return true;
  }

  updateName(name: string): void {
    this.#draft.name = name;
  }

  updateSize(sizeClass: SizeClass): void {
    this.#draft.sizeClass = sizeClass;
  }

  updateColors(primary: number, secondary: number): void {
    this.#draft.colorStages = [
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
  }

  updateCoreCount(count: number): void {
    const primary = this.#draft.colorStages[1]?.color ?? 0xff5577;
    const secondary = this.#draft.colorStages[2]?.color ?? 0x55aaff;
    this.#draft.coreLayers = [
      { radius: 0.38, color: primary },
      { radius: 0.66, color: secondary },
    ].slice(0, Math.min(Math.max(Math.round(count), 0), 2));
  }

  updateTrail(length: number, width: number): void {
    this.#draft.trailStyle.length = Math.min(Math.max(length, 0), 1);
    this.#draft.trailStyle.width = Math.min(Math.max(width, 0.6), 1.8);
  }

  updateChildCount(count: number): void {
    const safeCount = Math.min(Math.max(Math.round(count), 0), 18);
    this.#draft.childBursts =
      safeCount > 0 ? [{ count: safeCount, delay: 0.58, radius: 22 }] : [];
    this.#draft.burstShape =
      safeCount > 0
        ? "children"
        : this.#draft.pattern === "palm"
          ? "palm"
          : this.#draft.pattern === "heart"
            ? "heart"
            : "sphere";
  }

  updateAscentEffect(effect: AscentEffect): void {
    this.#draft.ascentEffect = effect;
  }

  save(): FireworkDesign {
    this.#draft = this.#repository.save(this.#draft);
    return this.draft;
  }

  duplicate(id: string): FireworkDesign | undefined {
    return this.#repository.duplicate(id);
  }

  remove(id: string): boolean {
    const removed = this.#repository.remove(id);
    if (removed && this.#draft.id === id) this.startBlank();
    return removed;
  }
}
