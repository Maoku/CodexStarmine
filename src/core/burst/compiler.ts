import type { Vector3Value } from "../particle";
import { createSeededRandom } from "../random";
import type {
  BranchStarLayer,
  ChildBurstLayer,
  FireworkDesign,
  FireworkLayer,
  PatternStarLayer,
  SphericalStarLayer,
  VirtualStarPreset,
} from "../../data/firework";

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
  return normalize({
    x: x * Math.cos(angle) + depth * Math.sin(angle),
    y,
    z: -x * Math.sin(angle) + depth * Math.cos(angle),
  });
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

function compileLayerStar(
  design: FireworkDesign,
  layer: FireworkLayer,
  direction: Vector3Value,
  definitionId: string,
  index: number,
  random: ReturnType<typeof createSeededRandom>,
): CompiledStar {
  const definition = resolveDefinition(design, definitionId);
  const velocityJitter = design.launchVariation.velocity;
  const placementJitter = design.launchVariation.placement;
  const speed =
    design.burstField.baseVelocity *
    layer.radialSpeedScale *
    (1 + random.signed() * velocityJitter);
  const normalized = normalize({
    x: direction.x + random.signed() * placementJitter,
    y: direction.y + random.signed() * placementJitter,
    z: direction.z + random.signed() * placementJitter,
  });
  return {
    definition: structuredClone(definition),
    id: `${layer.id}-star-${index}`,
    initialPosition: { x: 0, y: 0, z: 0 },
    initialVelocity: {
      x: normalized.x * speed,
      y: normalized.y * speed,
      z: normalized.z * speed,
    },
    intensityScale: definition.brightness,
    layerID: layer.id,
    lifetimeScale:
      1 + random.signed() * Math.min(design.launchVariation.lifetime, 0.25),
    timingOffset:
      layer.ignitionOffset +
      random.next() * Math.min(design.launchVariation.ignition, 0.2),
  };
}

function compileSpherical(
  design: FireworkDesign,
  layer: SphericalStarLayer,
  random: ReturnType<typeof createSeededRandom>,
): CompiledStar[] {
  const overrides = new Map(layer.overrides.map((item) => [item.index, item]));
  const points = fibonacciSphere(layer.count);
  const stars: CompiledStar[] = [];
  points.forEach((point, index) => {
    const override = overrides.get(index);
    if (override?.removed) return;
    if (
      random.next() <
      Math.min(layer.missingRate + design.realism.missingRate, 0.5)
    ) {
      return;
    }
    const source = override?.position ?? point;
    const direction = normalize({
      x: source.x + random.signed() * layer.jitter * 0.08,
      y: source.y + random.signed() * layer.jitter * 0.08,
      z: source.z + random.signed() * layer.jitter * 0.08,
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
        random,
      ),
    );
  });
  return stars;
}

function compilePattern(
  design: FireworkDesign,
  layer: PatternStarLayer,
  random: ReturnType<typeof createSeededRandom>,
): CompiledStar[] {
  const groups = new Map(layer.groups.map((group) => [group.id, group]));
  return layer.points.map((point, index) => {
    const group = groups.get(point.groupId);
    const depth = random.signed() * layer.depth;
    const orientation =
      layer.orientationDegrees + random.signed() * layer.rotationJitter;
    return compileLayerStar(
      design,
      layer,
      rotatePatternPoint(point.x, point.y, depth, orientation),
      group?.starId ?? layer.defaultStarId,
      index,
      random,
    );
  });
}

function compileBranch(
  design: FireworkDesign,
  layer: BranchStarLayer,
  random: ReturnType<typeof createSeededRandom>,
): CompiledStar[] {
  const stars: CompiledStar[] = [];
  for (let branch = 0; branch < layer.branchCount; branch += 1) {
    const angle = (branch / layer.branchCount) * Math.PI * 2;
    const tilt = 0.18 + random.next() * 0.5;
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
          direction,
          layer.defaultStarId,
          branch * layer.starsPerBranch + index,
          random,
        ),
      );
    }
  }
  return stars;
}

function compileChildren(
  design: FireworkDesign,
  layer: ChildBurstLayer,
  random: ReturnType<typeof createSeededRandom>,
): CompiledChildBurst[] {
  return fibonacciSphere(layer.count).map((carrier, index) => {
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
        layer.delay +
        index * layer.waveDelay +
        random.next() * design.launchVariation.ignition,
      id: `${layer.id}-child-${index}`,
      initialVelocity: {
        x: carrier.x * 22 * layer.radialSpeedScale,
        y: carrier.y * 22 * layer.radialSpeedScale,
        z: carrier.z * 22 * layer.radialSpeedScale,
      },
      layerID: layer.id,
      stars: compileSpherical(design, childLayer, random),
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
  design: FireworkDesign,
  launchSeed: number,
): CompiledBurstPlan {
  const random = createSeededRandom(launchSeed ^ design.assemblySeed);
  const stars: CompiledStar[] = [];
  const childBursts: CompiledChildBurst[] = [];
  for (const layer of design.layers) {
    if (!layer.visible) continue;
    if (layer.kind === "spherical") {
      stars.push(...compileSpherical(design, layer, random));
    } else if (layer.kind === "pattern") {
      stars.push(...compilePattern(design, layer, random));
    } else if (layer.kind === "branch") {
      stars.push(...compileBranch(design, layer, random));
    } else {
      childBursts.push(...compileChildren(design, layer, random));
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
