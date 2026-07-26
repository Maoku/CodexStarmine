import {
  evaluateMotionOffset,
  evaluateSecondaryEvent,
  type Vector3Value,
} from "../../core/particle";
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

export interface StarBehaviorPreviewSecondaryParticle {
  mode: "spark" | "microBurst";
  opacity: number;
  position: Vector3Value;
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
  if (star.id === "star-relay-light" || star.id === "star-gradient-fade") {
    return { count: 32, layout: "ring" };
  }
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

export function evaluatePreviewSecondaryParticles(
  particle: StarBehaviorPreviewParticle,
  star: VirtualStarPreset,
  ageSeconds: number,
): StarBehaviorPreviewSecondaryParticle[] {
  const normalizedAge = ageSeconds / Math.max(particle.lifetime, 0.0001);
  const samples: StarBehaviorPreviewSecondaryParticle[] = [];
  const append = (
    mode: "spark" | "microBurst",
    count: number,
    speedScale: number,
    triggerTime: number,
    seed: number,
  ) => {
    const event = evaluateSecondaryEvent(
      {
        secondary: {
          count,
          mode,
          speedScale,
          triggerTime,
        },
      },
      triggerTime - 0.000_001,
      normalizedAge,
      seed,
    );
    if (!event) return;
    const childAge = ageSeconds - triggerTime * particle.lifetime;
    const childLifetime = mode === "microBurst" ? 0.72 : 0.42;
    if (childAge < 0 || childAge > childLifetime) return;
    const origin = evaluatePreviewParticlePosition(
      particle,
      star,
      triggerTime * particle.lifetime,
    );
    const inheritedDrag = Math.exp(
      -star.drag * triggerTime * particle.lifetime,
    );
    const progress = childAge / childLifetime;
    event.particles.forEach((secondary) => {
      const speed = secondary.speedScale * (mode === "microBurst" ? 7.2 : 4.8);
      samples.push({
        mode,
        opacity: Math.pow(1 - progress, 1.4),
        position: {
          x:
            origin.x +
            (particle.initialVelocity.x * inheritedDrag * 0.12 +
              secondary.direction.x * speed) *
              childAge,
          y:
            origin.y +
            (particle.initialVelocity.y * inheritedDrag * 0.12 +
              secondary.direction.y * speed) *
              childAge -
            4.2 * childAge * childAge,
          z:
            origin.z +
            (particle.initialVelocity.z * inheritedDrag * 0.12 +
              secondary.direction.z * speed) *
              childAge,
        },
      });
    });
  };

  const secondary = star.effectProfile?.secondary;
  if (secondary && secondary.mode !== "none") {
    append(
      secondary.mode,
      Math.round(secondary.count ?? 0),
      secondary.speedScale ?? 1,
      secondary.triggerTime ?? 0.9,
      particle.effectSeed,
    );
  }
  const terminal = star.effectProfile?.light?.terminal;
  if (
    terminal &&
    terminal.mode !== "none" &&
    (terminal.sparkleCount ?? 0) > 0
  ) {
    append(
      "spark",
      Math.round(terminal.sparkleCount ?? 0),
      terminal.mode === "teka" ? 0.72 : 0.46,
      1 - terminal.duration,
      particle.effectSeed ^ 0x71c3_9a5d,
    );
  }
  return samples;
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
        layout === "fan"
          ? (index / Math.max(count - 1, 1)) * 0.12
          : layout === "ring"
            ? index / count
            : 0,
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
