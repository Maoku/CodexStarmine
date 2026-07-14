import { calculateSoundDelay } from "../core/env";
import type { Vector3Value } from "../core/particle";
import type { FireworkDesign } from "../data";

const LISTENER_POSITION: Vector3Value = { x: 0, y: 13, z: 74 };

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.round(context.sampleRate * 1.4);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const envelope = Math.exp((-index / length) * 6.4);
    channel[index] = (Math.random() * 2 - 1) * envelope;
  }
  return buffer;
}

export class FireworkAudio {
  #context?: AudioContext;
  #master?: GainNode;
  #noise?: AudioBuffer;
  #physicality = 1;

  set physicality(value: number) {
    this.#physicality = Math.min(Math.max(value, 0), 1);
  }

  get isReady(): boolean {
    return this.#context?.state === "running";
  }

  async unlock(): Promise<void> {
    if (!this.#context) {
      this.#context = new AudioContext({ latencyHint: "interactive" });
      this.#master = this.#context.createGain();
      this.#master.gain.value = 0.42;
      this.#master.connect(this.#context.destination);
      this.#noise = createNoiseBuffer(this.#context);
    }
    if (this.#context.state === "suspended") {
      await this.#context.resume();
    }
  }

  playLaunch(design: FireworkDesign): void {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master || context.state !== "running") return;

    const now = context.currentTime;
    const whistle = context.createOscillator();
    const gain = context.createGain();
    whistle.type = "triangle";
    whistle.frequency.setValueAtTime(185, now);
    whistle.frequency.exponentialRampToValueAtTime(720, now + 1.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      0.035 * design.soundProfile.volume,
      now + 0.05,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.08);
    whistle.connect(gain).connect(master);
    whistle.start(now);
    whistle.stop(now + 1.1);

    this.#playNoise(now, 0.055, 0.045 * design.soundProfile.volume, 0.14);
  }

  playBurst(position: Vector3Value, design: FireworkDesign): void {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master || context.state !== "running") return;

    const distance = Math.hypot(
      position.x - LISTENER_POSITION.x,
      position.y - LISTENER_POSITION.y,
      position.z - LISTENER_POSITION.z,
    );
    const start =
      context.currentTime + calculateSoundDelay(distance, this.#physicality);
    const volume = design.soundProfile.volume;

    const low = context.createOscillator();
    const lowGain = context.createGain();
    low.type = "sine";
    low.frequency.setValueAtTime(58, start);
    low.frequency.exponentialRampToValueAtTime(31, start + 0.78);
    lowGain.gain.setValueAtTime(0.0001, start);
    lowGain.gain.exponentialRampToValueAtTime(
      0.32 * volume * design.soundProfile.lowEnd,
      start + 0.014,
    );
    lowGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.86);
    low.connect(lowGain).connect(master);
    low.start(start);
    low.stop(start + 0.9);

    this.#playNoise(start, 0.11, 0.25 * volume, 0.74);
    const crackleCount = Math.round(2 + design.soundProfile.crackle * 6);
    for (let index = 0; index < crackleCount; index += 1) {
      this.#playNoise(
        start + 0.18 + index * 0.085 + Math.random() * 0.06,
        0.018,
        0.04 * volume * design.soundProfile.crackle,
        0.07,
      );
    }
    this.#playNoise(start + 0.42 + distance / 2_200, 0.14, 0.06 * volume, 0.72);
  }

  async dispose(): Promise<void> {
    await this.#context?.close();
    this.#context = undefined;
    this.#master = undefined;
    this.#noise = undefined;
  }

  #playNoise(
    start: number,
    attack: number,
    volume: number,
    duration: number,
  ): void {
    const context = this.#context;
    const master = this.#master;
    const noise = this.#noise;
    if (!context || !master || !noise) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = noise;
    filter.type = "lowpass";
    filter.frequency.value = duration > 0.5 ? 2_100 : 7_500;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(volume, 0.0001),
      start + attack,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
    source.stop(start + duration + 0.04);
  }
}
