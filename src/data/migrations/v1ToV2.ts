import { stableSeed } from "../../core/random";
import type {
  FireworkDesignV1,
  FireworkDesignV2,
  FireworkLayer,
  PatternPoint,
  VirtualStarPreset,
} from "../firework";
import { snapshotStarLibrary } from "../starPresets";

export function isFireworkDesignV1(value: unknown): value is FireworkDesignV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FireworkDesignV1>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.pattern === "string" &&
    typeof candidate.sizeClass === "string" &&
    typeof candidate.particleDensity === "number" &&
    Array.isArray(candidate.colorStages) &&
    Array.isArray(candidate.coreLayers) &&
    Array.isArray(candidate.childBursts)
  );
}

export function createHeartPoints(count = 72): PatternPoint[] {
  const dense = Array.from({ length: 720 }, (_, index) => {
    const angle = (index / 720) * Math.PI * 2;
    const x = 16 * Math.sin(angle) ** 3;
    const y =
      13 * Math.cos(angle) -
      5 * Math.cos(2 * angle) -
      2 * Math.cos(3 * angle) -
      Math.cos(4 * angle);
    return {
      groupId: x < 0 ? "left" : "right",
      x: x / 17,
      y: y / 17 - 0.08,
    };
  });
  const closed = [...dense, dense[0]];
  const cumulative = [0];
  for (let index = 1; index < closed.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        Math.hypot(
          closed[index].x - closed[index - 1].x,
          closed[index].y - closed[index - 1].y,
        ),
    );
  }
  const total = cumulative.at(-1) ?? 0;
  return Array.from({ length: count }, (_, index) => {
    const target = (index / count) * total;
    let segment = 1;
    while (segment < cumulative.length - 1 && cumulative[segment] < target) {
      segment += 1;
    }
    const start = closed[segment - 1];
    const end = closed[segment];
    const span = cumulative[segment] - cumulative[segment - 1] || 1;
    const progress = (target - cumulative[segment - 1]) / span;
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;
    return { groupId: x < 0 ? "left" : "right", x, y };
  });
}

function starFromV1(
  design: FireworkDesignV1,
  id: string,
  displayName: string,
  colors = design.colorStages,
): VirtualStarPreset {
  return {
    brightness: Math.max(colors[0]?.intensity ?? 1, 0.4),
    burnDuration: design.burnDuration,
    colorStages: structuredClone(colors),
    displayName,
    drag: design.drag,
    emissionKind:
      design.trailStyle.length > 0.65
        ? design.ascentEffect === "silver"
          ? "silverTail"
          : "charcoalTail"
        : "point",
    flicker: design.trailStyle.sparkle,
    gravityScale: design.gravityScale,
    id,
    smokeAmount: design.smokeProfile.amount,
    soundTag: design.soundProfile.crackle > 0.55 ? "crackle" : "soft",
    trailLifetime: design.trailStyle.length,
    trailWidth: design.trailStyle.width,
  };
}

function coreStar(
  design: FireworkDesignV1,
  id: string,
  color: number,
  index: number,
): VirtualStarPreset {
  return starFromV1(design, id, `芯${index + 1}の単色星`, [
    {
      color: 0xffffff,
      intensity: 1.2,
      normalizedTime: 0,
      trailColor: color,
    },
    {
      color,
      intensity: 0.92,
      normalizedTime: 0.16,
      trailColor: color,
    },
    {
      color,
      intensity: 0,
      normalizedTime: 1,
      trailColor: color,
    },
  ]);
}

export function migrateV1ToV2(design: FireworkDesignV1): FireworkDesignV2 {
  const assemblySeed = stableSeed(`${design.id}:${design.name}:assembly`);
  const starDefinitions = snapshotStarLibrary();
  const outerStarId = `${design.id}-outer-star`;
  starDefinitions[outerStarId] = starFromV1(
    design,
    outerStarId,
    `${design.name} 外周星`,
  );
  const layers: FireworkLayer[] = [];

  if (design.burstShape === "heart") {
    layers.push({
      allowedAngle: 35,
      defaultStarId: outerStarId,
      depth: 0.04,
      facingPolicy: "audience",
      groups: [
        { id: "left", name: "左輪郭", starId: outerStarId },
        { id: "right", name: "右輪郭", starId: outerStarId },
      ],
      id: "layer-pattern",
      ignitionOffset: 0,
      kind: "pattern",
      locked: false,
      name: "ハート型物",
      orientationDegrees: 0,
      points: createHeartPoints(Math.max(design.particleDensity, 48)),
      radialSpeedScale: 1,
      rotationJitter: 8,
      template: "heart",
      visible: true,
    });
  } else if (design.burstShape === "palm") {
    layers.push({
      branchCount: 11,
      defaultStarId: outerStarId,
      id: "layer-branches",
      ignitionOffset: 0,
      kind: "branch",
      locked: false,
      name: "椰子の花弁",
      radialSpeedScale: 1,
      starsPerBranch: Math.max(Math.round(design.particleDensity / 11), 5),
      thickness: design.trailStyle.width,
      upwardBias: 0.52,
      visible: true,
    });
  } else {
    layers.push({
      coloring: { mode: "layer" },
      count:
        design.burstShape === "children"
          ? Math.max(Math.round(design.particleDensity * 0.24), 18)
          : design.particleDensity,
      defaultStarId: outerStarId,
      id: "layer-outer",
      ignitionOffset: 0,
      jitter: Math.max(0, 1 - design.symmetry),
      kind: "spherical",
      locked: false,
      missingRate: 0,
      name: "外周",
      overrides: [],
      placement: "fibonacci",
      placementSeed: assemblySeed + 11,
      radialSpeedScale: design.burstShape === "children" ? 0.36 : 1,
      radius: 1,
      visible: true,
    });
  }

  design.coreLayers.forEach((core, index) => {
    const starId = `${design.id}-core-${index + 1}-star`;
    starDefinitions[starId] = coreStar(design, starId, core.color, index);
    layers.push({
      coloring: { mode: "layer" },
      count: Math.max(
        Math.round(design.particleDensity * (0.24 + core.radius * 0.12)),
        24,
      ),
      defaultStarId: starId,
      id: `layer-core-${index + 1}`,
      ignitionOffset: 0,
      jitter: 0.01,
      kind: "spherical",
      locked: false,
      missingRate: 0,
      name: `芯 ${index + 1}`,
      overrides: [],
      placement: "fibonacci",
      placementSeed: assemblySeed + 101 + index * 19,
      radialSpeedScale: core.radius,
      radius: core.radius,
      visible: true,
    });
  });

  design.childBursts.forEach((child, index) => {
    layers.push({
      count: child.count,
      defaultStarId: "star-child",
      delay: child.delay,
      id: `layer-child-${index + 1}`,
      ignitionOffset: 0,
      kind: "child",
      locked: false,
      name: `子花 ${index + 1}`,
      placement: "sphere",
      radialSpeedScale: child.radius / 22,
      scale: 0.32,
      visible: true,
      waveDelay: 0.018,
    });
  });

  return {
    ...structuredClone(design),
    assemblySeed,
    burstField: {
      baseVelocity: design.burstVelocity,
      drag: design.drag,
      gravityScale: design.gravityScale,
      windResponse: design.windResponse,
    },
    description: "仮想星と内部配置で仕立てた花火デザイン",
    launchVariation: {
      ignition: 0.06,
      lifetime: 0.1,
      placement: 0.025,
      velocity: 0.055,
    },
    layers,
    realism: {
      ignitionJitter: 0.025,
      lifetimeJitter: 0.1,
      missingRate: 0,
      placementJitter: Math.max(0, 1 - design.symmetry) * 0.22,
      velocityJitter: Math.max(0.015, 1 - design.symmetry),
    },
    schemaVersion: 2,
    starDefinitions,
    themeColors: design.colorStages
      .filter((stage) => stage.intensity > 0)
      .slice(0, 3)
      .map((stage) => stage.color),
  };
}
