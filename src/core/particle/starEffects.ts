import type { ColorStage, VirtualStarEffectProfile } from "../../data/firework";
import type { Vector3Value } from "./particle";

export interface EvaluatedColor {
  color: number;
  intensity: number;
  trailColor: number;
}

export type VirtualStarTerminalState = "none" | "kouro" | "teka";

export interface SecondaryParticlePlan {
  direction: Vector3Value;
  speedScale: number;
}

export interface SecondaryEvent {
  mode: "spark" | "microBurst";
  particles: SecondaryParticlePlan[];
  triggerTime: number;
}

export interface EvaluateVirtualStarAppearanceInput {
  ageSeconds: number;
  colorStages: ColorStage[];
  effectPhase?: number;
  effectProfile?: VirtualStarEffectProfile;
  effectSeed?: number;
  legacyFlicker?: number;
  lifetimeSeconds: number;
  previousNormalizedAge?: number;
}

export interface EvaluatedVirtualStarAppearance extends EvaluatedColor {
  lightMultiplier: number;
  motionOffset: Vector3Value;
  secondaryEvent?: SecondaryEvent;
  terminalState: VirtualStarTerminalState;
  trailLightMultiplier: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function fract(value: number): number {
  return ((value % 1) + 1) % 1;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function hashUnit(seed: number, salt: number): number {
  let value = (Math.trunc(seed) ^ Math.imul(salt, 0x9e37_79b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb_352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846c_a68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4_294_967_296;
}

function mixChannel(start: number, end: number, amount: number): number {
  return Math.round(start + (end - start) * amount);
}

export function mixHexColors(
  start: number,
  end: number,
  amount: number,
): number {
  const t = clamp(amount, 0, 1);
  const red = mixChannel((start >> 16) & 0xff, (end >> 16) & 0xff, t);
  const green = mixChannel((start >> 8) & 0xff, (end >> 8) & 0xff, t);
  const blue = mixChannel(start & 0xff, end & 0xff, t);
  return (red << 16) | (green << 8) | blue;
}

function colorPlaybackAge(
  normalizedAge: number,
  profile?: VirtualStarEffectProfile,
): number {
  const age = clamp(normalizedAge, 0, 1);
  const playback = profile?.color?.playback ?? "once";
  const repeatCount = clamp(Math.round(profile?.color?.repeatCount ?? 1), 1, 8);
  if (playback === "once") return age;
  if (playback === "loop") {
    return age >= 1 ? 1 : fract(age * repeatCount);
  }
  const progress = age * repeatCount;
  const whole = Math.floor(progress);
  const local = progress - whole;
  return whole % 2 === 0 ? local : 1 - local;
}

export function evaluateColorStages(
  stages: ColorStage[],
  normalizedAge: number,
  profile?: VirtualStarEffectProfile,
): EvaluatedColor {
  if (stages.length === 0) {
    return { color: 0xffffff, intensity: 1, trailColor: 0xffffff };
  }

  const age = colorPlaybackAge(normalizedAge, profile);
  const sorted = [...stages].sort(
    (left, right) => left.normalizedTime - right.normalizedTime,
  );
  const first = sorted[0];
  const last = sorted.at(-1) ?? first;

  if (age <= first.normalizedTime) {
    return {
      color: first.color,
      intensity: first.intensity,
      trailColor: first.trailColor,
    };
  }

  if (profile?.color?.mode === "step") {
    const stage =
      [...sorted]
        .reverse()
        .find((candidate) => age >= candidate.normalizedTime) ?? first;
    return {
      color: stage.color,
      intensity: stage.intensity,
      trailColor: stage.trailColor,
    };
  }

  for (let index = 1; index < sorted.length; index += 1) {
    const end = sorted[index];
    if (age <= end.normalizedTime) {
      const start = sorted[index - 1];
      const range = Math.max(end.normalizedTime - start.normalizedTime, 0.0001);
      const amount = (age - start.normalizedTime) / range;
      return {
        color: mixHexColors(start.color, end.color, amount),
        intensity: start.intensity + (end.intensity - start.intensity) * amount,
        trailColor: mixHexColors(start.trailColor, end.trailColor, amount),
      };
    }
  }

  return {
    color: last.color,
    intensity: last.intensity,
    trailColor: last.trailColor,
  };
}

function strobeEnvelope(
  profile: VirtualStarEffectProfile,
  ageSeconds: number,
  effectPhase: number,
): number {
  const light = profile.light;
  if (!light || light.mode !== "strobe") return 1;
  const frequency = clamp(light.frequencyHz ?? 6, 0.5, 18);
  const dutyCycle = clamp(light.dutyCycle ?? 0.5, 0.08, 0.92);
  const phase = fract(
    ageSeconds * frequency + effectPhase + (light.phaseOffset ?? 0),
  );
  if (phase >= dutyCycle) return 0;
  const edge = Math.min(
    clamp(light.edgeSoftness ?? 0.06, 0, 0.45),
    dutyCycle * 0.5,
    (1 - dutyCycle) * 0.5,
  );
  if (edge <= 0) return 1;
  return Math.min(
    smoothstep(0, edge, phase),
    1 - smoothstep(dutyCycle - edge, dutyCycle, phase),
  );
}

function terminalEnvelope(
  profile: VirtualStarEffectProfile | undefined,
  normalizedAge: number,
): { multiplier: number; state: VirtualStarTerminalState } {
  const terminal = profile?.light?.terminal;
  if (!terminal || terminal.mode === "none" || normalizedAge >= 1) {
    return { multiplier: normalizedAge >= 1 ? 0 : 1, state: "none" };
  }
  const start = 1 - clamp(terminal.duration, 0.01, 0.2);
  if (normalizedAge < start) return { multiplier: 1, state: "none" };
  const progress = clamp(
    (normalizedAge - start) / Math.max(terminal.duration, 0.0001),
    0,
    1,
  );
  if (terminal.mode === "kouro") {
    const glow = smoothstep(0, 0.24, progress) * Math.pow(1 - progress, 0.55);
    return {
      multiplier: 1 + glow * terminal.strength,
      state: "kouro",
    };
  }
  const flash = Math.pow(Math.sin(Math.PI * progress), 8);
  return {
    multiplier: 1 + flash * terminal.strength,
    state: "teka",
  };
}

export function evaluateLightEnvelope(
  profile: VirtualStarEffectProfile | undefined,
  normalizedAge: number,
  effectPhase = 0,
  effectSeed = 0,
  ageSeconds = normalizedAge,
): number {
  void effectSeed;
  if (normalizedAge < 0 || normalizedAge >= 1) return 0;
  const terminal = terminalEnvelope(profile, normalizedAge);
  return (
    strobeEnvelope(profile ?? {}, ageSeconds, effectPhase) * terminal.multiplier
  );
}

export function evaluateDeterministicFlicker(
  amount: number,
  ageSeconds: number,
  effectSeed: number,
): number {
  const strength = clamp(amount, 0, 1);
  if (strength === 0) return 1;
  const sample = Math.max(ageSeconds, 0) * 12;
  const index = Math.floor(sample);
  const blend = smoothstep(0, 1, sample - index);
  const left = hashUnit(effectSeed, index);
  const right = hashUnit(effectSeed, index + 1);
  const noise = left + (right - left) * blend;
  return 1 - strength * 0.25 + noise * strength * 0.35;
}

export function evaluateMotionOffset(
  profile: VirtualStarEffectProfile | undefined,
  ageSeconds: number,
  effectPhase = 0,
  effectSeed = 0,
): Vector3Value {
  const motion = profile?.motion;
  if (!motion || motion.mode === "ballistic") return { x: 0, y: 0, z: 0 };
  const amplitude = clamp(motion.amplitude ?? 0.35, 0, 1);
  const frequency = clamp(motion.frequencyHz ?? 1, 0.1, 8);
  const phase =
    ageSeconds * frequency * Math.PI * 2 +
    effectPhase * Math.PI * 2 +
    hashUnit(effectSeed, 31) * Math.PI * 2;
  const initialPhase =
    effectPhase * Math.PI * 2 + hashUnit(effectSeed, 31) * Math.PI * 2;
  const oscillation = (scale = 1) =>
    (Math.sin(phase * scale) - Math.sin(initialPhase * scale)) * amplitude;
  if (motion.mode === "fallingLeaf") {
    return {
      x: oscillation(1) * 2.4,
      y: -amplitude * ageSeconds * ageSeconds * 0.9,
      z: oscillation(0.53) * 1.25,
    };
  }
  if (motion.mode === "wander") {
    return {
      x: oscillation(0.73) * 1.5,
      y: oscillation(0.41) * 0.42,
      z: oscillation(1.13) * 1.5,
    };
  }
  return {
    x: (Math.cos(phase) - Math.cos(initialPhase)) * amplitude * 1.8,
    y: oscillation(0.35) * 0.36,
    z: (Math.sin(phase) - Math.sin(initialPhase)) * amplitude * 1.8,
  };
}

function secondaryDirection(seed: number, index: number): Vector3Value {
  const y = hashUnit(seed, index * 3 + 101) * 2 - 1;
  const angle = hashUnit(seed, index * 3 + 102) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(1 - y * y, 0));
  return {
    x: Math.cos(angle) * radius,
    y,
    z: Math.sin(angle) * radius,
  };
}

export function evaluateSecondaryEvent(
  profile: VirtualStarEffectProfile | undefined,
  previousNormalizedAge: number,
  normalizedAge: number,
  effectSeed = 0,
): SecondaryEvent | undefined {
  const secondary = profile?.secondary;
  if (!secondary || secondary.mode === "none") return undefined;
  const triggerTime = clamp(secondary.triggerTime ?? 0.9, 0.35, 1);
  if (
    previousNormalizedAge >= triggerTime ||
    normalizedAge < triggerTime ||
    previousNormalizedAge > normalizedAge
  ) {
    return undefined;
  }
  const count = Math.round(clamp(secondary.count ?? 0, 0, 6));
  return {
    mode: secondary.mode,
    particles: Array.from({ length: count }, (_, index) => ({
      direction: secondaryDirection(effectSeed, index),
      speedScale:
        clamp(secondary.speedScale ?? 1, 0, 3) *
        (0.82 + hashUnit(effectSeed, index + 211) * 0.36),
    })),
    triggerTime,
  };
}

export function evaluateVirtualStarAppearance(
  input: EvaluateVirtualStarAppearanceInput,
): EvaluatedVirtualStarAppearance {
  const lifetime = Math.max(input.lifetimeSeconds, 0.0001);
  const normalizedAge = clamp(input.ageSeconds / lifetime, 0, 1);
  const color = evaluateColorStages(
    input.colorStages,
    normalizedAge,
    input.effectProfile,
  );
  const effectSeed = input.effectSeed ?? 0;
  const envelope = evaluateLightEnvelope(
    input.effectProfile,
    normalizedAge,
    input.effectPhase ?? 0,
    effectSeed,
    input.ageSeconds,
  );
  const flicker = evaluateDeterministicFlicker(
    input.legacyFlicker ?? 0,
    input.ageSeconds,
    effectSeed,
  );
  const terminal = terminalEnvelope(input.effectProfile, normalizedAge);
  return {
    ...color,
    lightMultiplier: envelope * flicker,
    motionOffset: evaluateMotionOffset(
      input.effectProfile,
      input.ageSeconds,
      input.effectPhase,
      effectSeed,
    ),
    secondaryEvent:
      input.previousNormalizedAge === undefined
        ? undefined
        : evaluateSecondaryEvent(
            input.effectProfile,
            input.previousNormalizedAge,
            normalizedAge,
            effectSeed,
          ),
    terminalState: terminal.state,
    trailLightMultiplier: envelope * (0.72 + flicker * 0.28),
  };
}
