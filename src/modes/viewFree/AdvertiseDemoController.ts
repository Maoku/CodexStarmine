import { ShowTimelinePlayer } from "../../core/show";
import type { FireworkDesign, ShowCue, ShowPlan } from "../../data";
import { generateFreeShow } from "./generateFreeShow";

export const ADVERTISE_DEMO_SEED = 73_101;

export interface AdvertiseDemoControllerOptions {
  getDesigns: () => FireworkDesign[];
  onCue: (cue: ShowCue) => void;
}

function createAdvertisePlan(
  designs: FireworkDesign[],
  cycle: number,
  reducedMotion: boolean,
): ShowPlan {
  const source = generateFreeShow(
    designs,
    0,
    ADVERTISE_DEMO_SEED + cycle * 811,
  );
  const interval = reducedMotion ? 3 : 2;
  const cues = source.cues.filter((_, index) => index % interval === 0);
  return {
    ...source,
    cues,
    id: `advertise-${cycle}`,
    title: "タイトルデモ",
  };
}

/** Low-density, muted title cues. Visibility and reduced motion are explicit inputs. */
export class AdvertiseDemoController {
  readonly #options: AdvertiseDemoControllerOptions;
  readonly #timeline = new ShowTimelinePlayer();
  #active = false;
  #cycle = 0;
  #pageVisible = true;
  #plan?: ShowPlan;
  #reducedMotion = false;

  constructor(options: AdvertiseDemoControllerOptions) {
    this.#options = options;
  }

  get isRunning(): boolean {
    return this.#active && this.#pageVisible && this.#timeline.isRunning;
  }

  start(): void {
    this.#active = true;
    this.#startNextPlan();
  }

  stop(): void {
    this.#active = false;
    this.#timeline.stop();
    this.#plan = undefined;
  }

  setPageVisible(visible: boolean): void {
    this.#pageVisible = visible;
  }

  setReducedMotion(reducedMotion: boolean): void {
    if (this.#reducedMotion === reducedMotion) return;
    this.#reducedMotion = reducedMotion;
    if (this.#active) this.#startNextPlan();
  }

  update(deltaSeconds: number): void {
    if (!this.#active || !this.#pageVisible || !this.#plan) return;
    const due = this.#timeline.update(deltaSeconds);
    due.forEach((cue) => this.#options.onCue(cue));
    if (this.#timeline.isComplete) this.#startNextPlan();
  }

  #startNextPlan(): void {
    this.#cycle += 1;
    this.#plan = createAdvertisePlan(
      this.#options.getDesigns(),
      this.#cycle,
      this.#reducedMotion,
    );
    this.#timeline.play(this.#plan.cues, this.#plan.duration);
  }
}
