import { calculateSoundDelay } from "../core/env";
import type { Vector3Value } from "../core/particle";
import type { CompiledBurstPlan } from "../core/burst";
import { resolveSizePreset, type FireworkDesign } from "../data";
import { deriveFireworkSoundCharacter } from "./FireworkSoundCharacter";

const LISTENER_POSITION: Vector3Value = { x: 0, y: 13, z: 74 };
const SILENCE = 0.0001;

interface NoiseVoiceOptions {
  attack: number;
  duration: number;
  filterEnd?: number;
  filterFrequency: number;
  filterQ?: number;
  filterType: BiquadFilterType;
  pan: number;
  reverb: number;
  start: number;
  sustain?: number;
  volume: number;
}

interface ToneVoiceOptions {
  attack: number;
  duration: number;
  endFrequency: number;
  endPan?: number;
  pan: number;
  reverb: number;
  start: number;
  startFrequency: number;
  type: OscillatorType;
  volume: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function volumeCurve(value: number): number {
  return Math.pow(clamp(value, 0, 1), 1.35);
}

function createNoiseBuffer(
  context: AudioContext,
  durationSeconds = 4.5,
): AudioBuffer {
  const length = Math.round(context.sampleRate * durationSeconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    // A little correlation keeps the synthesized noise from sounding purely
    // electronic once it is shaped into the launch and pressure-wave layers.
    previous = white * 0.82 + previous * 0.18;
    channel[index] = previous;
  }
  return buffer;
}

function createOutdoorImpulse(context: AudioContext): AudioBuffer {
  const durationSeconds = 2.8;
  const length = Math.round(context.sampleRate * durationSeconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (
    let channelIndex = 0;
    channelIndex < buffer.numberOfChannels;
    channelIndex += 1
  ) {
    const channel = buffer.getChannelData(channelIndex);
    for (let index = 0; index < length; index += 1) {
      const time = index / context.sampleRate;
      const decay = Math.pow(1 - index / length, 2.8);
      const diffusion = Math.random() * 2 - 1;
      const earlyReflection =
        (time > 0.085 + channelIndex * 0.011 &&
          time < 0.105 + channelIndex * 0.011) ||
        (time > 0.19 - channelIndex * 0.009 &&
          time < 0.225 - channelIndex * 0.009)
          ? 1.8
          : 0.24;
      channel[index] = diffusion * decay * earlyReflection;
    }
  }
  return buffer;
}

function distanceFromListener(position: Vector3Value): number {
  return Math.hypot(
    position.x - LISTENER_POSITION.x,
    position.y - LISTENER_POSITION.y,
    position.z - LISTENER_POSITION.z,
  );
}

export class FireworkAudio {
  #compressor?: DynamicsCompressorNode;
  #context?: AudioContext;
  #master?: GainNode;
  #noise?: AudioBuffer;
  #physicality = 1;
  #reverb?: ConvolverNode;
  #reverbReturn?: GainNode;
  #volume: number;

  constructor(volume = 0.7) {
    this.#volume = clamp(Number.isFinite(volume) ? volume : 0.7, 0, 1);
  }

  set physicality(value: number) {
    this.#physicality = clamp(Number.isFinite(value) ? value : 1, 0, 1);
  }

  set volume(value: number) {
    this.#volume = clamp(Number.isFinite(value) ? value : 0.7, 0, 1);
    const context = this.#context;
    const master = this.#master;
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(
      volumeCurve(this.#volume),
      context.currentTime,
      0.025,
    );
  }

  get volume(): number {
    return this.#volume;
  }

  get isReady(): boolean {
    return this.#context?.state === "running";
  }

  async unlock(): Promise<void> {
    if (!this.#context) {
      this.#context = new AudioContext({ latencyHint: "interactive" });
      this.#master = this.#context.createGain();
      this.#master.gain.value = volumeCurve(this.#volume);

      this.#compressor = this.#context.createDynamicsCompressor();
      this.#compressor.threshold.value = -12;
      this.#compressor.knee.value = 18;
      this.#compressor.ratio.value = 4.5;
      this.#compressor.attack.value = 0.003;
      this.#compressor.release.value = 0.38;
      this.#master.connect(this.#compressor).connect(this.#context.destination);

      this.#reverb = this.#context.createConvolver();
      this.#reverb.buffer = createOutdoorImpulse(this.#context);
      this.#reverbReturn = this.#context.createGain();
      this.#reverbReturn.gain.value = 0.2;
      this.#reverb.connect(this.#reverbReturn).connect(this.#master);

      this.#noise = createNoiseBuffer(this.#context);
    }
    if (this.#context.state === "suspended") {
      await this.#context.resume();
    }
  }

  playLaunch(
    position: Vector3Value,
    design: FireworkDesign,
    plan?: CompiledBurstPlan,
  ): void {
    const context = this.#context;
    if (!context || !this.#master || context.state !== "running") return;

    const distance = distanceFromListener(position);
    const start =
      context.currentTime + calculateSoundDelay(distance, this.#physicality);
    const size = resolveSizePreset(design.sizeClass);
    const sizeScale = Math.sqrt(size.burstScale);
    const attenuation = clamp(1 / (1 + distance / 430), 0.44, 0.9);
    const level = design.soundProfile.volume * attenuation * sizeScale;
    const character = deriveFireworkSoundCharacter(design, plan);
    const duration =
      design.sizeClass === "large"
        ? 3.35
        : design.sizeClass === "medium"
          ? 2.9
          : 2.45;
    const pan = clamp((position.x - LISTENER_POSITION.x) / 105, -0.68, 0.68);

    // Mortar ignition: a short crack followed by the low pressure pulse from
    // the launch tube.
    this.#playNoiseVoice({
      attack: 0.002,
      duration: 0.16,
      filterEnd: 720,
      filterFrequency: 1_900,
      filterQ: 0.7,
      filterType: "bandpass",
      pan,
      reverb: 0.18,
      start,
      sustain: 0.08,
      volume: 0.2 * level,
    });
    this.#playToneVoice({
      attack: 0.006,
      duration: 0.42,
      endFrequency: 39,
      pan,
      reverb: 0.12,
      start,
      startFrequency: 88,
      type: "sine",
      volume: 0.13 * level,
    });

    // Two differently filtered combustion layers make the ascent feel like a
    // moving, turbulent gas jet instead of a single oscillator.
    this.#playNoiseVoice({
      attack: 0.06,
      duration,
      filterEnd: 2_600 * character.bodyBrightness,
      filterFrequency: 780 * character.bodyBrightness,
      filterQ: 0.82,
      filterType: "bandpass",
      pan,
      reverb: 0.08,
      start: start + 0.035,
      sustain: 0.32,
      volume: 0.07 * level,
    });
    this.#playNoiseVoice({
      attack: 0.09,
      duration: duration * 0.88,
      filterEnd: 520,
      filterFrequency: 260,
      filterQ: 0.55,
      filterType: "lowpass",
      pan,
      reverb: 0.06,
      start: start + 0.04,
      sustain: 0.24,
      volume: 0.055 * level,
    });

    // A restrained Doppler-like tone conveys upward motion without the clean,
    // cartoon whistle of the old single oscillator.
    const whistleStart =
      (design.ascentEffect === "silver" ? 690 : 570) *
      (1 +
        character.starMix.silverTail * 0.18 -
        character.starMix.warmTail * 0.08);
    const whistleGain =
      (design.ascentEffect === "none" ? 0.0025 : 0.008) *
      (1 +
        character.starMix.silverTail * 0.3 +
        character.starMix.warmTail * 0.12);
    this.#playToneVoice({
      attack: 0.22,
      duration: duration * 0.82,
      endFrequency: whistleStart * 2.35,
      pan,
      reverb: 0.1,
      start: start + 0.14,
      startFrequency: whistleStart,
      type: "sine",
      volume: whistleGain * level,
    });

    const sputterCount = Math.round(
      4 +
        duration * 2.4 +
        (character.starMix.silverTail + character.starMix.warmTail) * 4,
    );
    for (let index = 0; index < sputterCount; index += 1) {
      const progress = (index + Math.random() * 0.8) / sputterCount;
      this.#playNoiseVoice({
        attack: 0.002,
        duration: 0.025 + Math.random() * 0.045,
        filterFrequency:
          (2_400 + Math.random() * 3_600) *
          (0.9 + character.starMix.silverTail * 0.22),
        filterQ: 0.55,
        filterType: "highpass",
        pan: clamp(pan + (Math.random() - 0.5) * 0.08, -0.72, 0.72),
        reverb: 0.04,
        start: start + 0.11 + progress * duration * 0.78,
        sustain: 0.05,
        volume: (0.009 + Math.random() * 0.012) * level,
      });
    }
  }

  playBurst(
    position: Vector3Value,
    design: FireworkDesign,
    plan?: CompiledBurstPlan,
  ): void {
    const context = this.#context;
    if (!context || !this.#master || context.state !== "running") return;

    const distance = distanceFromListener(position);
    const start =
      context.currentTime + calculateSoundDelay(distance, this.#physicality);
    const size = resolveSizePreset(design.sizeClass);
    const sizeScale = Math.sqrt(size.burstScale);
    const attenuation = clamp(1 / (1 + distance / 520), 0.42, 0.9);
    const level = design.soundProfile.volume * attenuation * sizeScale;
    const character = deriveFireworkSoundCharacter(design, plan);
    const lowEnd = clamp(
      design.soundProfile.lowEnd * character.lowEndScale,
      0,
      1.45,
    );
    const crackle = clamp(
      design.soundProfile.crackle * character.crackleScale,
      0,
      1.65,
    );
    const pan = clamp((position.x - LISTENER_POSITION.x) / 105, -0.72, 0.72);

    // The first few milliseconds carry the sharp pressure front. The filtered
    // body and low oscillators arrive together, then decay at different rates.
    this.#playNoiseVoice({
      attack: 0.0015,
      duration: 0.12 / Math.max(character.bodyBrightness, 0.62),
      filterEnd: 1_100 * character.bodyBrightness,
      filterFrequency: 5_800 * character.bodyBrightness,
      filterQ: 0.58,
      filterType: "highpass",
      pan,
      reverb: clamp(0.28 * character.reverbScale, 0, 0.6),
      start,
      sustain: 0.035,
      volume: 0.34 * level * character.reportScale,
    });
    this.#playNoiseVoice({
      attack: 0.004,
      duration: 1.48 * character.bodyDurationScale,
      filterEnd: 720,
      filterFrequency: clamp(
        (3_200 - distance * 4.1) * character.bodyBrightness,
        720,
        4_600,
      ),
      filterQ: 0.68,
      filterType: "lowpass",
      pan,
      reverb: clamp(0.34 * character.reverbScale, 0, 0.65),
      start: start + 0.005,
      sustain: 0.16,
      volume: 0.28 * level * (0.84 + character.reportScale * 0.16),
    });
    this.#playToneVoice({
      attack: 0.008,
      duration: 1.08,
      endFrequency: 24 / Math.sqrt(character.lowEndScale),
      pan,
      reverb: 0.18,
      start: start + 0.004,
      startFrequency: 57 / Math.sqrt(character.lowEndScale),
      type: "sine",
      volume: (0.2 + lowEnd * 0.22) * level * character.rumbleScale,
    });
    this.#playToneVoice({
      attack: 0.004,
      duration: 0.58,
      endFrequency: 45,
      pan,
      reverb: 0.16,
      start: start + 0.002,
      startFrequency: 118,
      type: "triangle",
      volume:
        (0.035 + lowEnd * 0.05) * level * Math.sqrt(character.rumbleScale),
    });

    // Broad, staggered reflections make the report roll across the landscape
    // rather than ending as a single synthetic noise envelope.
    const reflectionDelays = [0.23, 0.47, 0.79];
    reflectionDelays.forEach((delay, index) => {
      this.#playNoiseVoice({
        attack: 0.025 + index * 0.015,
        duration:
          (0.68 + index * 0.22) * Math.sqrt(character.bodyDurationScale),
        filterEnd: 430,
        filterFrequency: 1_150 - index * 190,
        filterQ: 0.72,
        filterType: "lowpass",
        pan: clamp(pan * (0.4 - index * 0.1) + (index - 1) * 0.09, -0.5, 0.5),
        reverb: clamp(0.38 * character.reverbScale, 0, 0.72),
        start: start + delay + distance / 2_800,
        sustain: 0.12,
        volume: (0.07 - index * 0.013) * level * character.reflectionScale,
      });
    });

    const crackleCount = 1 + Math.round(crackle * 13);
    for (let index = 0; index < crackleCount; index += 1) {
      const spread = 0.12 + Math.pow(Math.random(), 0.72) * 1.2;
      this.#playNoiseVoice({
        attack: 0.0015,
        duration: 0.025 + Math.random() * 0.06,
        filterFrequency: 2_200 + Math.random() * 4_800,
        filterQ: 0.48,
        filterType: "highpass",
        pan: clamp(pan + (Math.random() - 0.5) * 0.28, -0.85, 0.85),
        reverb: 0.2,
        start: start + spread,
        sustain: 0.035,
        volume: (0.012 + Math.random() * 0.028) * level * (0.3 + crackle),
      });
    }

    for (const secondary of character.secondaryReports) {
      const secondaryStart = start + secondary.delay;
      const secondaryPan = clamp(pan + secondary.panOffset, -0.88, 0.88);
      this.#playNoiseVoice({
        attack: 0.0015,
        duration: 0.11,
        filterEnd: 1_200,
        filterFrequency: 4_300 * secondary.brightness,
        filterQ: 0.62,
        filterType: "bandpass",
        pan: secondaryPan,
        reverb: clamp(0.2 * character.reverbScale, 0, 0.5),
        start: secondaryStart,
        sustain: 0.04,
        volume: 0.15 * level * secondary.strength,
      });
      this.#playToneVoice({
        attack: 0.004,
        duration: 0.34,
        endFrequency: 48,
        pan: secondaryPan,
        reverb: 0.12,
        start: secondaryStart + 0.002,
        startFrequency: 112,
        type: "sine",
        volume: 0.055 * level * secondary.strength,
      });
    }

    for (const voice of character.movingVoices) {
      this.#playToneVoice({
        attack: 0.035,
        duration: voice.duration,
        endFrequency: voice.endFrequency,
        endPan: clamp(pan + voice.endPanOffset, -0.92, 0.92),
        pan: clamp(pan + voice.startPanOffset, -0.92, 0.92),
        reverb: 0.12,
        start: start + voice.delay,
        startFrequency: voice.startFrequency,
        type: character.style === "spinner" ? "triangle" : "sine",
        volume: voice.gain * level,
      });
    }

    for (let index = 0; index < character.tailSizzleCount; index += 1) {
      const progress =
        (index + 0.35 + Math.random() * 0.3) /
        Math.max(character.tailSizzleCount, 1);
      this.#playNoiseVoice({
        attack: 0.0015,
        duration: 0.024 + Math.random() * 0.042,
        filterFrequency:
          character.tailSizzleFrequency * (0.82 + Math.random() * 0.36),
        filterQ: 0.5,
        filterType: "highpass",
        pan: clamp(pan + (Math.random() - 0.5) * 0.34, -0.9, 0.9),
        reverb: 0.14,
        start: start + 0.16 + progress * character.tailSizzleDuration,
        sustain: 0.04,
        volume:
          (0.008 + Math.random() * 0.014) *
          level *
          (0.7 + character.starMix.flicker * 0.5),
      });
    }
  }

  async dispose(): Promise<void> {
    await this.#context?.close();
    this.#context = undefined;
    this.#master = undefined;
    this.#compressor = undefined;
    this.#noise = undefined;
    this.#reverb = undefined;
    this.#reverbReturn = undefined;
  }

  #connectVoice(
    node: AudioNode,
    pan: number,
    reverb: number,
    movement?: { end: number; endPan: number; start: number },
  ): void {
    const context = this.#context;
    const master = this.#master;
    if (!context || !master) return;

    const panner = context.createStereoPanner();
    if (movement) {
      panner.pan.setValueAtTime(clamp(pan, -1, 1), movement.start);
      panner.pan.linearRampToValueAtTime(
        clamp(movement.endPan, -1, 1),
        movement.end,
      );
    } else {
      panner.pan.value = clamp(pan, -1, 1);
    }
    node.connect(panner);
    panner.connect(master);

    if (this.#reverb && reverb > 0) {
      const send = context.createGain();
      send.gain.value = clamp(reverb, 0, 1);
      panner.connect(send).connect(this.#reverb);
    }
  }

  #playNoiseVoice(options: NoiseVoiceOptions): void {
    const context = this.#context;
    const noise = this.#noise;
    if (!context || !noise || options.volume <= 0) return;

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const attackEnd = options.start + Math.max(options.attack, 0.001);
    const sustainAt =
      options.start + Math.max(options.duration * 0.62, options.attack + 0.002);
    const end = options.start + options.duration;

    source.buffer = noise;
    filter.type = options.filterType;
    filter.Q.value = options.filterQ ?? 0.7;
    filter.frequency.setValueAtTime(
      Math.max(options.filterFrequency, 20),
      options.start,
    );
    if (options.filterEnd) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(options.filterEnd, 20),
        end,
      );
    }

    gain.gain.setValueAtTime(SILENCE, options.start);
    gain.gain.linearRampToValueAtTime(
      Math.max(options.volume, SILENCE),
      attackEnd,
    );
    gain.gain.exponentialRampToValueAtTime(
      Math.max(options.volume * (options.sustain ?? 0.18), SILENCE),
      Math.min(sustainAt, end - 0.001),
    );
    gain.gain.exponentialRampToValueAtTime(SILENCE, end);

    source.connect(filter).connect(gain);
    this.#connectVoice(gain, options.pan, options.reverb);
    const availableOffset = Math.max(
      noise.duration - options.duration - 0.02,
      0,
    );
    source.start(options.start, Math.random() * availableOffset);
    source.stop(end + 0.04);
  }

  #playToneVoice(options: ToneVoiceOptions): void {
    const context = this.#context;
    if (!context || options.volume <= 0) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const attackEnd = options.start + Math.max(options.attack, 0.001);
    const end = options.start + options.duration;
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(
      Math.max(options.startFrequency, 20),
      options.start,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(options.endFrequency, 20),
      end,
    );
    gain.gain.setValueAtTime(SILENCE, options.start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(options.volume, SILENCE),
      attackEnd,
    );
    gain.gain.exponentialRampToValueAtTime(SILENCE, end);
    oscillator.connect(gain);
    this.#connectVoice(
      gain,
      options.pan,
      options.reverb,
      options.endPan === undefined
        ? undefined
        : {
            end,
            endPan: options.endPan,
            start: options.start,
          },
    );
    oscillator.start(options.start);
    oscillator.stop(end + 0.03);
  }
}
