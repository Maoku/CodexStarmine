import { ShowTimelinePlayer } from "../../core/show";
import type { FireworkDesign, ShowCue, ShowPlan } from "../../data";
import { describeShowPhase, generateFreeShow } from "./generateFreeShow";

export interface FreeShowState {
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
  #density = 1;
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
    for (const cue of due) this.#options.onCue(cue);
    if (this.#timeline.isComplete) {
      this.#startNextPlan();
    } else if (this.#timeline.isRunning) {
      this.#emitState();
    }
  }

  #startNextPlan(): void {
    this.#cycle += 1;
    this.#plan = generateFreeShow(
      this.#options.getDesigns(),
      this.#density,
      20_260 + this.#cycle * 977,
    );
    this.#timeline.play(this.#plan.cues, this.#plan.duration);
    this.#emitState();
  }

  #emitState(): void {
    this.#options.onState({
      detail: this.#timeline.isRunning
        ? describeShowPhase(this.#timeline.time)
        : "余韻を残して一時停止中",
      running: this.#timeline.isRunning,
      title: this.#plan?.title ?? "湖畔の演目",
    });
  }
}
