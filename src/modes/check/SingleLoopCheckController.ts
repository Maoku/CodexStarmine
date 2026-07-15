import type { FireworkDesign } from "../../data";

export const CHECK_LAUNCH_SEED = 50_226;
export const CHECK_LOOP_INTERVAL_SECONDS = 8;

export interface SingleLoopCheckState {
  active: boolean;
  designName: string;
  loopEnabled: boolean;
  running: boolean;
  secondsUntilLaunch: number;
  shotCount: number;
}

export interface SingleLoopCheckControllerOptions {
  intervalSeconds?: number;
  onLaunch: (design: FireworkDesign, seed: number) => void;
  onState: (state: SingleLoopCheckState) => void;
  seed?: number;
}

function cloneDesign(design: FireworkDesign): FireworkDesign {
  return structuredClone(design);
}

export class SingleLoopCheckController {
  readonly #intervalSeconds: number;
  readonly #onLaunch: SingleLoopCheckControllerOptions["onLaunch"];
  readonly #onState: SingleLoopCheckControllerOptions["onState"];
  readonly #seed: number;
  #active = false;
  #design?: FireworkDesign;
  #elapsedSeconds = 0;
  #lastStateKey = "";
  #loopEnabled = true;
  #pendingImmediateLaunch = false;
  #running = false;
  #shotCount = 0;

  constructor(options: SingleLoopCheckControllerOptions) {
    this.#intervalSeconds = Math.max(
      options.intervalSeconds ?? CHECK_LOOP_INTERVAL_SECONDS,
      0.1,
    );
    this.#onLaunch = options.onLaunch;
    this.#onState = options.onState;
    this.#seed = Math.trunc(options.seed ?? CHECK_LAUNCH_SEED);
  }

  get isActive(): boolean {
    return this.#active;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  start(design: FireworkDesign): void {
    this.#active = true;
    this.#design = cloneDesign(design);
    this.#elapsedSeconds = 0;
    this.#lastStateKey = "";
    this.#loopEnabled = true;
    this.#pendingImmediateLaunch = true;
    this.#running = true;
    this.#shotCount = 0;
    this.#emitState(true);
  }

  stop(): void {
    this.#active = false;
    this.#design = undefined;
    this.#elapsedSeconds = 0;
    this.#pendingImmediateLaunch = false;
    this.#running = false;
    this.#shotCount = 0;
    this.#emitState(true);
  }

  pause(): void {
    if (!this.#active || !this.#running) return;
    this.#running = false;
    this.#emitState(true);
  }

  resume(): void {
    if (!this.#active || this.#running) return;
    if (!this.#loopEnabled) {
      this.#elapsedSeconds = 0;
      this.#pendingImmediateLaunch = true;
    }
    this.#running = true;
    this.#emitState(true);
  }

  toggle(): void {
    if (this.#running) this.pause();
    else this.resume();
  }

  setLoopEnabled(enabled: boolean): void {
    if (!this.#active || this.#loopEnabled === enabled) return;
    this.#loopEnabled = enabled;
    if (!enabled && this.#shotCount > 0 && !this.#pendingImmediateLaunch) {
      this.#running = false;
    }
    this.#emitState(true);
  }

  update(deltaSeconds: number): void {
    if (!this.#active || !this.#running || !this.#design) return;

    if (this.#pendingImmediateLaunch) {
      this.#launch();
      return;
    }

    const delta = Number.isFinite(deltaSeconds) ? Math.max(deltaSeconds, 0) : 0;
    this.#elapsedSeconds += delta;
    if (this.#elapsedSeconds >= this.#intervalSeconds) {
      this.#launch();
      return;
    }
    this.#emitState();
  }

  #launch(): void {
    if (!this.#design) return;
    this.#onLaunch(cloneDesign(this.#design), this.#seed);
    this.#shotCount += 1;
    this.#elapsedSeconds = 0;
    this.#pendingImmediateLaunch = false;
    if (!this.#loopEnabled) this.#running = false;
    this.#emitState(true);
  }

  #emitState(force = false): void {
    const secondsUntilLaunch =
      !this.#active || !this.#running
        ? 0
        : this.#pendingImmediateLaunch
          ? 0
          : Math.max(this.#intervalSeconds - this.#elapsedSeconds, 0);
    const state: SingleLoopCheckState = {
      active: this.#active,
      designName: this.#design?.name ?? "編集中の花火",
      loopEnabled: this.#loopEnabled,
      running: this.#running,
      secondsUntilLaunch,
      shotCount: this.#shotCount,
    };
    const stateKey = JSON.stringify({
      ...state,
      secondsUntilLaunch: Math.ceil(secondsUntilLaunch * 10) / 10,
    });
    if (!force && stateKey === this.#lastStateKey) return;
    this.#lastStateKey = stateKey;
    this.#onState(state);
  }
}
