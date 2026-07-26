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

export {
  evaluateColorStages,
  mixHexColors,
  type EvaluatedColor,
} from "./starEffects";

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
