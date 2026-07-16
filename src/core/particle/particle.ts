import type { ColorStage } from "../../data";

export interface Vector3Value {
  x: number;
  y: number;
  z: number;
}

export interface BallisticParticle {
  age: number;
  drag: number;
  gravityScale: number;
  lifetime: number;
  position: Vector3Value;
  velocity: Vector3Value;
  windResponse: number;
}

export interface ParticleEnvironment {
  gravity: number;
  wind: Vector3Value;
}

export const BURST_PARTICLE_ENVIRONMENT: Readonly<ParticleEnvironment> = {
  gravity: 9.81,
  wind: { x: 1.25, y: 0, z: 0.18 },
};

export interface EvaluatedColor {
  color: number;
  intensity: number;
  trailColor: number;
}

function mixChannel(start: number, end: number, amount: number): number {
  return Math.round(start + (end - start) * amount);
}

export function mixHexColors(
  start: number,
  end: number,
  amount: number,
): number {
  const t = Math.min(Math.max(amount, 0), 1);
  const red = mixChannel((start >> 16) & 0xff, (end >> 16) & 0xff, t);
  const green = mixChannel((start >> 8) & 0xff, (end >> 8) & 0xff, t);
  const blue = mixChannel(start & 0xff, end & 0xff, t);
  return (red << 16) | (green << 8) | blue;
}

export function evaluateColorStages(
  stages: ColorStage[],
  normalizedAge: number,
): EvaluatedColor {
  if (stages.length === 0) {
    return { color: 0xffffff, intensity: 1, trailColor: 0xffffff };
  }

  const age = Math.min(Math.max(normalizedAge, 0), 1);
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

export function integrateParticle(
  particle: BallisticParticle,
  deltaSeconds: number,
  environment: ParticleEnvironment,
): void {
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  if (delta === 0) {
    return;
  }

  const dragFactor = Math.exp(-Math.max(particle.drag, 0) * delta);
  particle.velocity.x =
    particle.velocity.x * dragFactor +
    environment.wind.x * particle.windResponse * delta;
  particle.velocity.y =
    particle.velocity.y * dragFactor -
    environment.gravity * particle.gravityScale * delta;
  particle.velocity.z =
    particle.velocity.z * dragFactor +
    environment.wind.z * particle.windResponse * delta;

  particle.position.x += particle.velocity.x * delta;
  particle.position.y += particle.velocity.y * delta;
  particle.position.z += particle.velocity.z * delta;
  particle.age += delta;
}

/**
 * Advances a burst star with the same ignition-delay rule used by the runtime.
 * A return value of `true` means that ballistic motion was applied this frame.
 */
export function advanceBurstParticle(
  particle: BallisticParticle,
  deltaSeconds: number,
  environment: ParticleEnvironment = BURST_PARTICLE_ENVIRONMENT,
): boolean {
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  if (delta === 0) return false;
  if (particle.age < 0) {
    particle.age += delta;
    return false;
  }
  integrateParticle(particle, delta, environment);
  return true;
}
