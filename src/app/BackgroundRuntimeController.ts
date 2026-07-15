import type { FireworkDesign } from "../data";
import type { BackgroundRuntime } from "./renewalContracts";

export interface BackgroundRuntimeControllerOptions {
  clearScene: () => void;
  startAdvertise: () => void;
  startCheck: (design: FireworkDesign) => void;
  startFree: () => void;
  stopAdvertise: () => void;
  stopCheck: () => void;
  stopFree: () => void;
}

/** Owns the stop -> clear -> start transition shared by every app screen. */
export class BackgroundRuntimeController {
  readonly #options: BackgroundRuntimeControllerOptions;
  #runtime: BackgroundRuntime = "none";

  constructor(options: BackgroundRuntimeControllerOptions) {
    this.#options = options;
  }

  get runtime(): BackgroundRuntime {
    return this.#runtime;
  }

  set(runtime: BackgroundRuntime, design?: FireworkDesign): boolean {
    if (runtime === this.#runtime) return false;
    if (runtime === "check" && !design) {
      throw new Error("The check runtime requires a firework design.");
    }

    this.#options.stopAdvertise();
    this.#options.stopCheck();
    this.#options.stopFree();
    this.#options.clearScene();
    this.#runtime = runtime;

    if (runtime === "advertise") this.#options.startAdvertise();
    else if (runtime === "check") this.#options.startCheck(design!);
    else if (runtime === "free") this.#options.startFree();
    return true;
  }
}
