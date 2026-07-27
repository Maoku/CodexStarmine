import { ShowTimelinePlayer } from "../../core/show";
import type { FireworkDesign, ShowCue, ShowPlan } from "../../data";
import { describeShowPhase, generateFreeShow } from "./generateFreeShow";

export interface FreeShowState {
  currentFireworkName?: string;
  detail: string;
  running: boolean;
  title: string;
}

export interface FreeShowControllerOptions {
  getDesigns: () => FireworkDesign[];
  onCue: (cue: ShowCue) => void;
  onState: (state: FreeShowState) => void;
}

export class FreeShowController {
  readonly #options: FreeShowControllerOptions;
  readonly #timeline = new ShowTimelinePlayer();
  #cycle = 0;
  #currentFireworkName?: string;
  #density = 1;
  #designNames = new Map<string, string>();
  #plan?: ShowPlan;

  constructor(options: FreeShowControllerOptions) {
    this.#options = options;
  }

  get isRunning(): boolean {
    return this.#timeline.isRunning;
  }

  start(): void {
    this.#startNextPlan();
  }

  stop(): void {
    this.#timeline.stop();
    this.#currentFireworkName = undefined;
    this.#plan = undefined;
    this.#options.onState({
      currentFireworkName: undefined,
      detail: "演目を終了しました",
      running: false,
      title: "湖畔の演目",
    });
  }

  pause(): void {
    this.#timeline.pause();
    this.#emitState();
  }

  resume(): void {
    if (this.#timeline.isComplete || !this.#plan) {
      this.#startNextPlan();
    } else {
      this.#timeline.resume();
      this.#emitState();
    }
  }

  toggle(): void {
    if (this.isRunning) this.pause();
    else this.resume();
  }

  setDensity(value: number): void {
    this.#density = Math.min(Math.max(Math.round(value), 0), 2);
  }

  update(deltaSeconds: number): void {
    if (!this.#plan) return;
    const due = this.#timeline.update(deltaSeconds);
    for (const cue of due) {
      this.#currentFireworkName = this.#designNames.get(cue.fireworkDesignID);
      this.#options.onCue(cue);
    }
    if (this.#timeline.isComplete) {
      this.#startNextPlan();
    } else if (this.#timeline.isRunning) {
      this.#emitState();
    }
  }

  #startNextPlan(): void {
    this.#cycle += 1;
    const designs = this.#options.getDesigns();
    this.#designNames = new Map(
      designs.map((design) => [design.id, design.name]),
    );
    this.#currentFireworkName = undefined;
    this.#plan = generateFreeShow(
      designs,
      this.#density,
      20_260 + this.#cycle * 977,
    );
    this.#timeline.play(this.#plan.cues, this.#plan.duration);
    this.#emitState();
  }

  #emitState(): void {
    this.#options.onState({
      currentFireworkName: this.#currentFireworkName,
      detail: this.#timeline.isRunning
        ? describeShowPhase(this.#timeline.time)
        : "余韻を残して一時停止中",
      running: this.#timeline.isRunning,
      title: this.#plan?.title ?? "湖畔の演目",
    });
  }
}
