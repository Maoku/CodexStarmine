import type { ShowCue } from "../../data";

export class ShowTimelinePlayer {
  #cursor = 0;
  #cues: ShowCue[] = [];
  #duration = 0;
  #isRunning = false;
  #time = 0;

  get duration(): number {
    return this.#duration;
  }

  get isComplete(): boolean {
    return this.#time >= this.#duration && this.#cursor >= this.#cues.length;
  }

  get isRunning(): boolean {
    return this.#isRunning;
  }

  get time(): number {
    return this.#time;
  }

  play(cues: ShowCue[], duration?: number): void {
    this.#cues = [...cues].sort((left, right) => left.time - right.time);
    this.#duration = Math.max(
      duration ?? this.#cues.at(-1)?.time ?? 0,
      this.#cues.at(-1)?.time ?? 0,
    );
    this.#time = 0;
    this.#cursor = 0;
    this.#isRunning = true;
  }

  pause(): void {
    this.#isRunning = false;
  }

  resume(): void {
    if (!this.isComplete) this.#isRunning = true;
  }

  stop(): void {
    this.#cursor = 0;
    this.#cues = [];
    this.#duration = 0;
    this.#isRunning = false;
    this.#time = 0;
  }

  update(deltaSeconds: number): ShowCue[] {
    if (!this.#isRunning) return [];
    const delta = Number.isFinite(deltaSeconds) ? Math.max(deltaSeconds, 0) : 0;
    this.#time = Math.min(this.#time + delta, this.#duration);
    const due: ShowCue[] = [];
    while (
      this.#cursor < this.#cues.length &&
      this.#cues[this.#cursor].time <= this.#time
    ) {
      due.push(this.#cues[this.#cursor]);
      this.#cursor += 1;
    }
    if (this.isComplete) this.#isRunning = false;
    return due;
  }
}
