import {
  CURRENT_DERIVATION_VERSION,
  type FireworkLayer,
  type LayerEffectTiming,
  type SizeClass,
  type VirtualStarPreset,
} from "../../data/firework";
import type { Vector3Value } from "../particle";

export interface DeriveVirtualBehaviorInput {
  assemblySeed: number;
  derivationVersion: number;
  layer: FireworkLayer;
  localDensity?: number;
  normalizedPosition: Vector3Value;
  placementIndex?: number;
  sizeClass: SizeClass;
  star: VirtualStarPreset;
}

export interface DerivedVirtualBehavior {
  allowedAngle: number;
  baseVelocity: number;
  childDelay: number;
  childWaveDelay: number;
  drag: number;
  gravityScale: number;
  ignitionJitter: number;
  ignitionOffset: number;
  lifetimeJitter: number;
  lifetimeScale: number;
  missingRate: number;
  orientationDegrees: number;
  orientationPolicy: "audience" | "venue" | "seeded";
  placementJitter: number;
  radialSpeedScale: number;
  rotationJitter: number;
  spreadEnvelope: {
    radial: number;
    vertical: number;
  };
  velocityJitter: number;
}

export interface DeriveEffectPhaseInput {
  assemblySeed: number;
  groupCount?: number;
  groupIndex?: number;
  layerID: string;
  manualPhase?: number;
  placementCount: number;
  placementIndex: number;
  position: Vector3Value;
  radiusMaximum?: number;
  radiusMinimum?: number;
  timing?: LayerEffectTiming;
}

const SIZE_SPEED: Record<SizeClass, number> = {
  large: 1.08,
  medium: 1,
  small: 0.94,
};

const SIZE_GRAVITY: Record<SizeClass, number> = {
  large: 1.04,
  medium: 1,
  small: 0.96,
};

const SIZE_BASE_VELOCITY: Record<SizeClass, number> = {
  large: 37,
  medium: 34,
  small: 31,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function hashUnit(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

function fract(value: number): number {
  return ((value % 1) + 1) % 1;
}

/**
 * Resolves authored layer timing without consuming a launch PRNG. The same
 * saved position, group, and index therefore keep the same phase in preview
 * and production compilation.
 */
export function deriveEffectPhase(input: DeriveEffectPhaseInput): number {
  const timing = input.timing;
  if (!timing || timing.mapping === "none") return 0;
  const count = Math.max(Math.round(input.placementCount), 1);
  const indexPhase = input.placementIndex / Math.max(count - 1, 1);
  const radius = Math.hypot(
    input.position.x,
    input.position.y,
    input.position.z,
  );
  let mapped: number;
  if (timing.mapping === "random") {
    mapped = hashUnit(
      `${input.assemblySeed}:${input.layerID}:${input.placementIndex}:phase`,
    );
  } else if (timing.mapping === "index") {
    mapped = indexPhase;
  } else if (timing.mapping === "longitude") {
    mapped = fract(
      Math.atan2(input.position.z, input.position.x) / (Math.PI * 2),
    );
  } else if (timing.mapping === "latitude") {
    mapped = radius > 0 ? input.position.y / radius / 2 + 0.5 : 0.5;
  } else if (timing.mapping === "radius") {
    const minimum = input.radiusMinimum ?? 0;
    const maximum = input.radiusMaximum ?? 1;
    mapped =
      maximum - minimum > 0.000_001
        ? (radius - minimum) / (maximum - minimum)
        : 0;
  } else if (timing.mapping === "group") {
    mapped =
      (input.groupIndex ?? input.placementIndex) /
      Math.max((input.groupCount ?? count) - 1, 1);
  } else {
    mapped = input.manualPhase ?? indexPhase;
  }
  const directed = timing.direction === "reverse" ? 1 - mapped : mapped;
  return fract(
    timing.offset +
      directed * clamp(timing.spread, 0, 1) * clamp(timing.cycles, 1, 4),
  );
}

function layerRadius(layer: FireworkLayer, positionRadius: number): number {
  if (layer.kind === "spherical") return clamp(layer.radius, 0.16, 1);
  if (layer.kind === "pattern") return 0.92;
  if (layer.kind === "branch") return clamp(positionRadius, 0.18, 1);
  return clamp(0.58 + layer.scale * 0.5, 0.42, 0.9);
}

function emissionSpeed(star: VirtualStarPreset): number {
  if (star.emissionKind === "child") return 0.78;
  if (star.emissionKind === "goldTail") return 0.93;
  if (star.emissionKind === "charcoalTail") return 0.95;
  if (star.emissionKind === "silverTail") return 1.02;
  return 1;
}

function placementSignature(layer: FireworkLayer): string {
  if (layer.kind === "spherical") return layer.placement;
  if (layer.kind === "pattern") return layer.template;
  if (layer.kind === "child") return layer.placement;
  return "branch";
}

function placementSpeed(layer: FireworkLayer): number {
  const signature = placementSignature(layer);
  if (signature === "manual" || signature === "custom") return 0.97;
  if (signature === "latitude" || signature === "ring") return 0.99;
  if (signature === "heart" || signature === "smile") return 0.98;
  return 1;
}

/**
 * Converts visual design intent into stable runtime behavior. Launch seed is
 * deliberately absent: it may add small playback variation later, but cannot
 * change the saved assembly result.
 */
export function deriveVirtualBehavior(
  input: DeriveVirtualBehaviorInput,
): DerivedVirtualBehavior {
  if (input.derivationVersion !== CURRENT_DERIVATION_VERSION) {
    throw new Error(
      `Unsupported derivation version: ${input.derivationVersion}`,
    );
  }

  const positionRadius = clamp(
    Math.hypot(
      input.normalizedPosition.x,
      input.normalizedPosition.y,
      input.normalizedPosition.z,
    ),
    0,
    1,
  );
  const radius = layerRadius(input.layer, positionRadius);
  const latitude =
    positionRadius > 0
      ? Math.abs(input.normalizedPosition.y / positionRadius)
      : 0;
  const density = clamp(input.localDensity ?? 0.5, 0, 1);
  const seedUnit = hashUnit(
    [
      input.assemblySeed,
      input.derivationVersion,
      input.layer.id,
      placementSignature(input.layer),
      input.star.id,
    ].join(":"),
  );
  const indexUnit = hashUnit(
    `${input.layer.id}:${input.placementIndex ?? 0}:${input.assemblySeed}`,
  );
  const kindScale =
    input.layer.kind === "pattern"
      ? 0.94
      : input.layer.kind === "child"
        ? 0.74
        : 1;
  const radialSpeedScale = clamp(
    radius *
      kindScale *
      SIZE_SPEED[input.sizeClass] *
      emissionSpeed(input.star) *
      placementSpeed(input.layer),
    0.16,
    1.18,
  );

  let orientationPolicy: DerivedVirtualBehavior["orientationPolicy"] = "seeded";
  let orientationDegrees = Math.round(seedUnit * 360);
  let allowedAngle = 42;
  let rotationJitter = 14;
  if (input.layer.kind === "pattern") {
    if (input.layer.facingPolicy === "audience") {
      orientationPolicy = "audience";
      orientationDegrees = 0;
      allowedAngle = 28;
      rotationJitter = 5;
    } else if (input.layer.facingPolicy === "venue") {
      orientationPolicy = "venue";
      orientationDegrees = Math.round(seedUnit * 4) * 90;
      allowedAngle = 20;
      rotationJitter = 3;
    }
  }

  const childDelay =
    input.layer.kind === "child"
      ? 0.44 +
        input.layer.scale * 0.42 +
        (input.sizeClass === "large" ? 0.08 : 0)
      : 0;
  const childWaveDelay =
    input.layer.kind === "child"
      ? clamp(0.01 + density * 0.012 + indexUnit * 0.002, 0.01, 0.024)
      : 0;
  const placementJitter = clamp(
    0.008 +
      density * 0.018 +
      (1 - radius) * 0.008 +
      (placementSignature(input.layer) === "manual" ? 0.006 : 0),
    0.008,
    0.04,
  );

  return {
    allowedAngle,
    baseVelocity: SIZE_BASE_VELOCITY[input.sizeClass],
    childDelay,
    childWaveDelay,
    drag: clamp(
      input.star.drag * (input.sizeClass === "large" ? 0.96 : 1),
      0.12,
      1.2,
    ),
    gravityScale: clamp(
      input.star.gravityScale * SIZE_GRAVITY[input.sizeClass],
      0.2,
      2.2,
    ),
    ignitionJitter: clamp(0.025 + density * 0.025, 0.02, 0.06),
    ignitionOffset:
      input.layer.kind === "child"
        ? 0
        : clamp((1 - radius) * 0.035 + latitude * 0.004, 0, 0.034),
    lifetimeJitter: clamp(0.045 + density * 0.045, 0.045, 0.09),
    lifetimeScale: clamp(
      0.96 + radius * 0.06 + (seedUnit - 0.5) * 0.02,
      0.94,
      1.04,
    ),
    missingRate: clamp(density > 0.86 ? (density - 0.86) * 0.08 : 0, 0, 0.02),
    orientationDegrees,
    orientationPolicy,
    placementJitter,
    radialSpeedScale,
    rotationJitter,
    spreadEnvelope: {
      radial: clamp(radialSpeedScale * (0.94 + density * 0.08), 0.16, 1.2),
      vertical: clamp(
        radialSpeedScale *
          (input.layer.kind === "branch"
            ? 1.16
            : 0.96 + seedUnit * 0.04 + latitude * 0.04),
        0.16,
        1.3,
      ),
    },
    velocityJitter: clamp(0.025 + density * 0.04, 0.025, 0.07),
  };
}
