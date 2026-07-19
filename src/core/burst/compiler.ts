import type { Vector3Value } from "../particle";
import { createSeededRandom } from "../random";
import type {
  AnyFireworkDesign,
  BranchStarLayer,
  ChildBurstLayer,
  FireworkDesign,
  FireworkLayer,
  PatternStarLayer,
  SphericalStarLayer,
  VirtualStarPreset,
} from "../../data/firework";
import { resolveCurrentIntent } from "../../data/migrations/v3ToV4";
import { deriveVirtualBehavior } from "./deriveVirtualBehavior";

export interface CompiledStar {
  definition: VirtualStarPreset;
  id: string;
  initialPosition: Vector3Value;
  initialVelocity: Vector3Value;
  intensityScale: number;
  layerID: string;
  lifetimeScale: number;
  timingOffset: number;
}

export interface CompiledChildBurst {
  delay: number;
  id: string;
  initialVelocity: Vector3Value;
  layerID: string;
  stars: CompiledStar[];
}

export interface EstimatedBurstCost {
  childBurstCount: number;
  maximumParticles: number;
  starCount: number;
  trailCount: number;
}

export interface CompiledBurstPlan {
  bounds: { radius: number };
  childBursts: CompiledChildBurst[];
  estimatedCost: EstimatedBurstCost;
  stars: CompiledStar[];
  warnings: string[];
}

export function fibonacciSphere(count: number): Vector3Value[] {
  const safeCount = Math.max(Math.round(count), 1);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: safeCount }, (_, index) => {
    const y = 1 - ((index + 0.5) / safeCount) * 2;
    const radius = Math.sqrt(Math.max(1 - y * y, 0));
    const angle = index * goldenAngle;
    return {
      x: Math.cos(angle) * radius,
      y,
      z: Math.sin(angle) * radius,
    };
  });
}

function normalize(vector: Vector3Value): Vector3Value {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function rotatePatternPoint(
  x: number,
  y: number,
  depth: number,
  degrees: number,
): Vector3Value {
  const angle = (degrees / 180) * Math.PI;
  return {
    x: x * Math.cos(angle) + depth * Math.sin(angle),
    y,
    z: -x * Math.sin(angle) + depth * Math.cos(angle),
  };
}

function resolveDefinition(
  design: FireworkDesign,
  id: string,
): VirtualStarPreset {
  return (
    design.starDefinitions[id] ??
    Object.values(design.starDefinitions)[0] ?? {
      brightness: 1,
      burnDuration: design.burnDuration,
      colorStages: design.colorStages,
      displayName: "仮想星",
      drag: design.drag,
      emissionKind: "point",
      flicker: design.trailStyle.sparkle,
      gravityScale: design.gravityScale,
      id: "fallback-star",
      smokeAmount: design.smokeProfile.amount,
      soundTag: "soft",
      trailLifetime: design.trailStyle.length,
      trailWidth: design.trailStyle.width,
    }
  );
}

function layerDensity(layer: FireworkLayer): number {
  if (layer.kind === "spherical") return Math.min(layer.count / 900, 1);
  if (layer.kind === "pattern") return Math.min(layer.points.length / 320, 1);
  if (layer.kind === "branch") {
    return Math.min((layer.branchCount * layer.starsPerBranch) / 320, 1);
  }
  return Math.min(layer.count / 48, 1);
}

function compileLayerStar(
  design: FireworkDesign,
  layer: FireworkLayer,
  direction: Vector3Value,
  definitionId: string,
  index: number,
  random: ReturnType<typeof createSeededRandom>,
  preserveMagnitude = false,
): CompiledStar {
  const sourceDefinition = resolveDefinition(design, definitionId);
  const behavior =
    design.schemaVersion === 3
      ? deriveVirtualBehavior({
          assemblySeed: design.assemblySeed,
          derivationVersion: design.derivationVersion,
          layer,
          localDensity: layerDensity(layer),
          normalizedPosition: direction,
          placementIndex: index,
          sizeClass: design.sizeClass,
          star: sourceDefinition,
        })
      : undefined;
  const definition = structuredClone(sourceDefinition);
  if (behavior) {
    definition.drag = behavior.drag;
    definition.gravityScale = behavior.gravityScale;
  }
  const velocityJitter =
    behavior?.velocityJitter ?? design.launchVariation.velocity;
  const placementJitter =
    behavior?.placementJitter ?? design.launchVariation.placement;
  const preservedSpeedScale =
    layer.kind === "pattern"
      ? (behavior?.radialSpeedScale ?? layer.radialSpeedScale)
      : layer.radialSpeedScale;
  const speed = preserveMagnitude
    ? (behavior?.baseVelocity ?? design.burstField.baseVelocity) *
      preservedSpeedScale *
      (1 + random.signed() * Math.min(velocityJitter, 0.015))
    : (behavior?.baseVelocity ?? design.burstField.baseVelocity) *
      (behavior?.radialSpeedScale ?? layer.radialSpeedScale) *
      (1 + random.signed() * velocityJitter);
  const velocityVector = preserveMagnitude
    ? direction
    : normalize({
        x: direction.x + random.signed() * placementJitter,
        y: direction.y + random.signed() * placementJitter,
        z: direction.z + random.signed() * placementJitter,
      });
  return {
    definition,
    id: `${layer.id}-star-${index}`,
    initialPosition: { x: 0, y: 0, z: 0 },
    initialVelocity: {
      x: velocityVector.x * speed,
      y: velocityVector.y * speed,
      z: velocityVector.z * speed,
    },
    intensityScale: definition.brightness,
    layerID: layer.id,
    lifetimeScale:
      (behavior?.lifetimeScale ?? 1) *
      (1 +
        random.signed() *
          Math.min(
            behavior?.lifetimeJitter ?? design.launchVariation.lifetime,
            0.25,
          )),
    timingOffset:
      (behavior?.ignitionOffset ?? layer.ignitionOffset) +
      random.next() *
        Math.min(
          behavior?.ignitionJitter ?? design.launchVariation.ignition,
          0.2,
        ),
  };
}

export function isValidAuthoredPoint(point: Vector3Value): boolean {
  const radius = Math.hypot(point.x, point.y, point.z);
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.z) &&
    radius > 1e-5 &&
    radius <= 1 + 1e-6
  );
}

/** Compiles saved 3D point magnitudes without spherical normalization. */
export function compileAuthoredPoints(
  design: FireworkDesign,
  layer: SphericalStarLayer,
  launchRandom: ReturnType<typeof createSeededRandom>,
): CompiledStar[] {
  return layer.overrides.flatMap((override, index) => {
    if (override.removed || !override.position) return [];
    if (!isValidAuthoredPoint(override.position)) return [];
    return [
      compileLayerStar(
        design,
        layer,
        override.position,
        override.starId ?? layer.defaultStarId,
        override.index ?? index,
        launchRandom,
        true,
      ),
    ];
  });
}

function compileSpherical(
  design: FireworkDesign,
  layer: SphericalStarLayer,
  assemblyRandom: ReturnType<typeof createSeededRandom>,
  launchRandom: ReturnType<typeof createSeededRandom>,
  authored = false,
): CompiledStar[] {
  if (authored) return compileAuthoredPoints(design, layer, launchRandom);
  const overrides = new Map(layer.overrides.map((item) => [item.index, item]));
  const points = fibonacciSphere(layer.count);
  const stars: CompiledStar[] = [];
  points.forEach((point, index) => {
    const override = overrides.get(index);
    if (override?.removed) return;
    const source = override?.position ?? point;
    const definitionId = override?.starId ?? layer.defaultStarId;
    const behavior =
      design.schemaVersion === 3
        ? deriveVirtualBehavior({
            assemblySeed: design.assemblySeed,
            derivationVersion: design.derivationVersion,
            layer,
            localDensity: layerDensity(layer),
            normalizedPosition: source,
            placementIndex: index,
            sizeClass: design.sizeClass,
            star: resolveDefinition(design, definitionId),
          })
        : undefined;
    if (
      assemblyRandom.next() <
      Math.min(
        behavior?.missingRate ?? layer.missingRate + design.realism.missingRate,
        0.5,
      )
    ) {
      return;
    }
    const direction = behavior
      ? normalize({
          x: source.x + assemblyRandom.signed() * 0,
          y: source.y + assemblyRandom.signed() * 0,
          z: source.z + assemblyRandom.signed() * 0,
        })
      : normalize({
          x: source.x + assemblyRandom.signed() * layer.jitter * 0.08,
          y: source.y + assemblyRandom.signed() * layer.jitter * 0.08,
          z: source.z + assemblyRandom.signed() * layer.jitter * 0.08,
        });
    const useAlternate =
      Boolean(layer.coloring.alternateStarId) &&
      (layer.coloring.mode === "alternating"
        ? index % 2 === 1
        : layer.coloring.mode === "latitude"
          ? direction.y > 0
          : layer.coloring.mode === "longitude"
            ? direction.x > 0
            : false);
    stars.push(
      compileLayerStar(
        design,
        layer,
        direction,
        override?.starId ??
          (useAlternate
            ? (layer.coloring.alternateStarId ?? layer.defaultStarId)
            : layer.defaultStarId),
        index,
        launchRandom,
      ),
    );
  });
  return stars;
}

function compilePattern(
  design: FireworkDesign,
  layer: PatternStarLayer,
  assemblyRandom: ReturnType<typeof createSeededRandom>,
  launchRandom: ReturnType<typeof createSeededRandom>,
): CompiledStar[] {
  const groups = new Map(layer.groups.map((group) => [group.id, group]));
  return layer.points.map((point, index) => {
    const group = groups.get(point.groupId);
    const depth = assemblyRandom.signed() * layer.depth;
    const definitionId = group?.starId ?? layer.defaultStarId;
    const definition = resolveDefinition(design, definitionId);
    const behavior =
      design.schemaVersion === 3
        ? deriveVirtualBehavior({
            assemblySeed: design.assemblySeed,
            derivationVersion: design.derivationVersion,
            layer,
            localDensity: layerDensity(layer),
            normalizedPosition: { x: point.x, y: point.y, z: depth },
            placementIndex: index,
            sizeClass: design.sizeClass,
            star: definition,
          })
        : undefined;
    const orientation =
      (behavior?.orientationDegrees ?? layer.orientationDegrees) +
      assemblyRandom.signed() *
        (behavior?.rotationJitter ?? layer.rotationJitter);
    return compileLayerStar(
      design,
      layer,
      rotatePatternPoint(point.x, point.y, depth, orientation),
      definitionId,
      index,
      launchRandom,
      true,
    );
  });
}

function compileBranch(
  design: FireworkDesign,
  layer: BranchStarLayer,
  assemblyRandom: ReturnType<typeof createSeededRandom>,
  launchRandom: ReturnType<typeof createSeededRandom>,
): CompiledStar[] {
  const stars: CompiledStar[] = [];
  for (let branch = 0; branch < layer.branchCount; branch += 1) {
    const angle = (branch / layer.branchCount) * Math.PI * 2;
    const tilt = 0.18 + assemblyRandom.next() * 0.5;
    for (let index = 0; index < layer.starsPerBranch; index += 1) {
      const progress = (index + 1) / layer.starsPerBranch;
      const direction = normalize({
        x: Math.cos(angle) * tilt * (0.7 + progress * 0.3),
        y: layer.upwardBias + (1 - progress) * 0.55,
        z: Math.sin(angle) * tilt * (0.7 + progress * 0.3),
      });
      stars.push(
        compileLayerStar(
          design,
          { ...layer, radialSpeedScale: layer.radialSpeedScale * progress },
          design.schemaVersion === 3
            ? {
                x: direction.x * progress,
                y: direction.y * progress,
                z: direction.z * progress,
              }
            : direction,
          layer.defaultStarId,
          branch * layer.starsPerBranch + index,
          launchRandom,
        ),
      );
    }
  }
  return stars;
}

function compileChildren(
  design: FireworkDesign,
  layer: ChildBurstLayer,
  assemblyRandom: ReturnType<typeof createSeededRandom>,
  launchRandom: ReturnType<typeof createSeededRandom>,
): CompiledChildBurst[] {
  return fibonacciSphere(layer.count).map((carrier, index) => {
    const definition = resolveDefinition(design, layer.defaultStarId);
    const behavior =
      design.schemaVersion === 3
        ? deriveVirtualBehavior({
            assemblySeed: design.assemblySeed,
            derivationVersion: design.derivationVersion,
            layer,
            localDensity: layerDensity(layer),
            normalizedPosition: carrier,
            placementIndex: index,
            sizeClass: design.sizeClass,
            star: definition,
          })
        : undefined;
    const childLayer: SphericalStarLayer = {
      coloring: { mode: "layer" },
      count: 24,
      defaultStarId: layer.defaultStarId,
      id: `${layer.id}-burst-${index}`,
      ignitionOffset: 0,
      jitter: 0.04,
      kind: "spherical",
      locked: true,
      missingRate: 0,
      name: `${layer.name} ${index + 1}`,
      overrides: [],
      placement: "fibonacci",
      placementSeed: design.assemblySeed + index * 31,
      radialSpeedScale: layer.scale * 0.34,
      radius: layer.scale,
      visible: true,
    };
    return {
      delay:
        (behavior?.childDelay ?? layer.delay) +
        index * (behavior?.childWaveDelay ?? layer.waveDelay) +
        launchRandom.next() *
          (behavior?.ignitionJitter ?? design.launchVariation.ignition),
      id: `${layer.id}-child-${index}`,
      initialVelocity: {
        x:
          carrier.x *
          22 *
          (behavior?.radialSpeedScale ?? layer.radialSpeedScale),
        y:
          carrier.y *
          22 *
          (behavior?.radialSpeedScale ?? layer.radialSpeedScale),
        z:
          carrier.z *
          22 *
          (behavior?.radialSpeedScale ?? layer.radialSpeedScale),
      },
      layerID: layer.id,
      stars: compileSpherical(design, childLayer, assemblyRandom, launchRandom),
    };
  });
}

export function estimateBurstCost(
  stars: CompiledStar[],
  children: CompiledChildBurst[],
): EstimatedBurstCost {
  const childStarCount = children.reduce(
    (sum, child) => sum + child.stars.length,
    0,
  );
  const allStars = [...stars, ...children.flatMap((child) => child.stars)];
  return {
    childBurstCount: children.length,
    maximumParticles: stars.length + childStarCount,
    starCount: stars.length,
    trailCount: allStars.filter((star) => star.definition.trailLifetime > 0.24)
      .length,
  };
}

export function compileFireworkDesign(
  design: AnyFireworkDesign,
  launchSeed: number,
): CompiledBurstPlan {
  if (design.schemaVersion === 4) {
    const authoredLayerIds = new Set(
      design.layers
        .filter((layer) => ["manual", "pattern"].includes(layer.authoringMode))
        .map((layer) => layer.id),
    );
    return compileRuntimeFireworkDesign(
      resolveCurrentIntent(design),
      launchSeed,
      authoredLayerIds,
    );
  }
  return compileRuntimeFireworkDesign(design, launchSeed);
}

function compileRuntimeFireworkDesign(
  design: FireworkDesign,
  launchSeed: number,
  authoredLayerIds: ReadonlySet<string> = new Set(),
): CompiledBurstPlan {
  const launchRandom = createSeededRandom(launchSeed ^ design.assemblySeed);
  const assemblyRandom =
    design.schemaVersion === 3
      ? createSeededRandom(design.assemblySeed ^ 0x5f37_59df)
      : launchRandom;
  const stars: CompiledStar[] = [];
  const childBursts: CompiledChildBurst[] = [];
  for (const layer of design.layers) {
    if (!layer.visible) continue;
    if (layer.kind === "spherical") {
      stars.push(
        ...compileSpherical(
          design,
          layer,
          assemblyRandom,
          launchRandom,
          authoredLayerIds.has(layer.id),
        ),
      );
    } else if (layer.kind === "pattern") {
      stars.push(
        ...compilePattern(design, layer, assemblyRandom, launchRandom),
      );
    } else if (layer.kind === "branch") {
      stars.push(...compileBranch(design, layer, assemblyRandom, launchRandom));
    } else {
      childBursts.push(
        ...compileChildren(design, layer, assemblyRandom, launchRandom),
      );
    }
  }
  const estimatedCost = estimateBurstCost(stars, childBursts);
  const warnings: string[] = [];
  if (estimatedCost.maximumParticles > 6_000) {
    warnings.push(
      "実行上限6,000星を超えます。星数または子花数を減らしてください。",
    );
  } else if (estimatedCost.maximumParticles > 2_000) {
    warnings.push(
      "2,000星を超える高負荷設計です。端末によって簡略表示されます。",
    );
  }
  if (estimatedCost.trailCount > 1_200) {
    warnings.push("尾を持つ仮想星が多いため、尾を短くする候補があります。");
  }
  return {
    bounds: {
      radius: Math.max(
        ...stars.map((star) =>
          Math.hypot(
            star.initialVelocity.x,
            star.initialVelocity.y,
            star.initialVelocity.z,
          ),
        ),
        0,
      ),
    },
    childBursts,
    estimatedCost,
    stars,
    warnings,
  };
}
