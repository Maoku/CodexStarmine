import { evaluateMotionOffset, type Vector3Value } from "../../core/particle";
import { stableSeed } from "../../core/random";
import type { VirtualStarPreset } from "../../data";

export type StarBehaviorPreviewLayout =
  "fan" | "ring" | "sparse-sphere" | "sphere";

export interface StarBehaviorPreviewParticle {
  effectPhase: number;
  effectSeed: number;
  initialPosition: Vector3Value;
  initialVelocity: Vector3Value;
  lifetime: number;
}

export interface StarBehaviorPreviewScenario {
  blackoutDuration: number;
  duration: number;
  layout: StarBehaviorPreviewLayout;
  particles: StarBehaviorPreviewParticle[];
  seed: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function fibonacciSphere(count: number): Vector3Value[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - ((index + 0.5) / count) * 2;
    const radius = Math.sqrt(Math.max(1 - y * y, 0));
    const angle = index * goldenAngle;
    return {
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius,
    };
  });
}

function scenarioLayout(star: VirtualStarPreset): {
  count: number;
  layout: StarBehaviorPreviewLayout;
} {
  const motion = star.effectProfile?.motion?.mode;
  const secondary = star.effectProfile?.secondary?.mode;
  if (secondary && secondary !== "none") {
    return { count: 12, layout: "sparse-sphere" };
  }
  if (motion && motion !== "ballistic") {
    return { count: 18, layout: "fan" };
  }
  return { count: 28, layout: "sphere" };
}

function directions(
  layout: StarBehaviorPreviewLayout,
  count: number,
): Vector3Value[] {
  if (layout === "ring") {
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      return { x: Math.cos(angle), y: Math.sin(angle), z: 0 };
    });
  }
  if (layout === "fan") {
    return Array.from({ length: count }, (_, index) => {
      const progress = count <= 1 ? 0.5 : index / (count - 1);
      const angle = -Math.PI * 0.38 + progress * Math.PI * 0.76;
      return {
        x: Math.sin(angle) * 0.82,
        y: 0.72 + Math.cos(angle) * 0.3,
        z: (progress - 0.5) * 0.36,
      };
    });
  }
  return fibonacciSphere(count);
}

export function evaluatePreviewParticlePosition(
  particle: StarBehaviorPreviewParticle,
  star: VirtualStarPreset,
  ageSeconds: number,
): Vector3Value {
  const age = Math.max(ageSeconds, 0);
  const drag = Math.max(star.drag * 0.34, 0.0001);
  const dragIntegral = (1 - Math.exp(-drag * age)) / drag;
  const gravity = 9.81 * star.gravityScale * 0.46;
  const gravityIntegral = age / drag - dragIntegral / drag;
  const motion = evaluateMotionOffset(
    star.effectProfile,
    age,
    particle.effectPhase,
    particle.effectSeed,
  );
  return {
    x:
      particle.initialPosition.x +
      particle.initialVelocity.x * dragIntegral +
      motion.x,
    y:
      particle.initialPosition.y +
      particle.initialVelocity.y * dragIntegral -
      gravity * gravityIntegral +
      motion.y,
    z:
      particle.initialPosition.z +
      particle.initialVelocity.z * dragIntegral +
      motion.z,
  };
}

export function buildStarBehaviorPreviewScenario(
  star: VirtualStarPreset,
  seed = stableSeed(`star-behavior-preview:${star.id}`),
): StarBehaviorPreviewScenario {
  const { count, layout } = scenarioLayout(star);
  const points = directions(layout, count);
  const speed =
    layout === "fan" ? 10.5 : layout === "sparse-sphere" ? 8.4 : 9.2;
  const terminalDuration =
    (star.effectProfile?.light?.terminal?.duration ?? 0) * star.burnDuration;
  const secondaryTail =
    star.effectProfile?.secondary?.mode &&
    star.effectProfile.secondary.mode !== "none"
      ? 0.72
      : 0;
  return {
    blackoutDuration: 0.15,
    duration: clamp(
      star.burnDuration + Math.max(terminalDuration, secondaryTail, 0.28),
      1.8,
      5.8,
    ),
    layout,
    particles: points.map((direction, index) => ({
      effectPhase:
        layout === "fan" ? (index / Math.max(count - 1, 1)) * 0.12 : 0,
      effectSeed: stableSeed(`${seed}:${star.id}:${index}`),
      initialPosition: { x: 0, y: 0, z: 0 },
      initialVelocity: {
        x: direction.x * speed,
        y: direction.y * speed,
        z: direction.z * speed,
      },
      lifetime: star.burnDuration,
    })),
    seed,
  };
}
