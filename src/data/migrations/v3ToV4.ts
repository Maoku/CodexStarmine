import {
  CURRENT_DERIVATION_VERSION,
  FIREWORK_DESIGN_V3_SCHEMA_VERSION,
  FIREWORK_DESIGN_V4_SCHEMA_VERSION,
  type AnyFireworkDesign,
  type FireworkDesignV3,
  type FireworkDesignV4,
  type FireworkLayer,
  type LayerBaseV4,
  type LayerIntentV4,
  type ManualLayerIntent,
  type PresetLayerIntent,
  type SectionRatio,
  type SectionRef,
  type SpatialColoring,
} from "../firework";
import { createPatternRecipePoints } from "../../ui/craft/PatternRecipe";
import { migrateV2ToV3 } from "./v2ToV3";

export const V3_TO_V4_REGRESSION_SEED = 624_207;
export const SECTION_RATIOS = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fibonacciSphere(count: number): Array<{
  x: number;
  y: number;
  z: number;
}> {
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

function nearestSectionRatio(fixedCoordinate: number): SectionRatio {
  return SECTION_RATIOS.reduce((best, ratio) => {
    const coordinate = ratio * 2 - 1;
    const bestCoordinate = best * 2 - 1;
    return Math.abs(coordinate - fixedCoordinate) <
      Math.abs(bestCoordinate - fixedCoordinate)
      ? ratio
      : best;
  }, 0.5 as SectionRatio);
}

function inferSection(position: {
  x: number;
  y: number;
  z: number;
}): SectionRef {
  if (Math.abs(position.z) <= Math.abs(position.y)) {
    return { plane: "xy", ratio: nearestSectionRatio(position.z) };
  }
  return { plane: "xz", ratio: nearestSectionRatio(position.y) };
}

function baseIntent(layer: FireworkLayer): LayerBaseV4 {
  return {
    defaultStarId: layer.defaultStarId,
    ...(layer.effectTiming
      ? { effectTiming: clone(layer.effectTiming) }
      : undefined),
    id: layer.id,
    ignitionOffset: layer.ignitionOffset,
    locked: layer.locked,
    name: layer.name,
    radialSpeedScale: layer.radialSpeedScale,
    visible: layer.visible,
  };
}

function defaultPresetParameters() {
  return {
    branchCount: 8,
    childDelay: 0.58,
    childPlacement: "sphere" as const,
    childScale: 0.32,
    childWaveDelay: 0.018,
    coloring: { mode: "layer" } as SpatialColoring,
    count: 72,
    jitter: 0,
    missingRate: 0,
    placement: "fibonacci" as const,
    placementSeed: 1,
    radius: 1,
    starsPerBranch: 12,
    thickness: 0.08,
    upwardBias: 0.72,
  };
}

function migrateLayer(layer: FireworkLayer, index: number): LayerIntentV4 {
  const base = baseIntent(layer);
  if (layer.kind === "pattern") {
    const groups = new Map(
      layer.groups.map((group) => [group.id, group.starId]),
    );
    return {
      ...base,
      authoringMode: "manual",
      points: layer.points.map((point, pointIndex) => {
        const position = { x: point.x, y: point.y, z: layer.depth };
        return {
          id: `${layer.id}-point-${pointIndex}`,
          position,
          section: { plane: "xy", ratio: nearestSectionRatio(layer.depth) },
          starId: groups.get(point.groupId) ?? layer.defaultStarId,
        };
      }),
    } satisfies ManualLayerIntent;
  }
  if (
    layer.kind === "spherical" &&
    (layer.placement === "manual" ||
      layer.overrides.some((override) => override.position !== undefined))
  ) {
    const overrides = new Map(
      layer.overrides.map((override) => [override.index, override]),
    );
    const points = fibonacciSphere(layer.count).flatMap(
      (position, pointIndex) => {
        const override = overrides.get(pointIndex);
        if (override?.removed) return [];
        const resolvedPosition = override?.position ?? position;
        return [
          {
            ...(override?.effectPhase === undefined
              ? undefined
              : { effectPhase: override.effectPhase }),
            id: `${layer.id}-point-${pointIndex}`,
            position: clone(resolvedPosition),
            section: inferSection(resolvedPosition),
            starId: override?.starId ?? layer.defaultStarId,
          },
        ];
      },
    );
    return { ...base, authoringMode: "manual", points };
  }

  const parameters = defaultPresetParameters();
  let presetKind: PresetLayerIntent["presetKind"];
  if (layer.kind === "spherical") {
    presetKind = index === 0 && !layer.name.includes("芯") ? "outer" : "core";
    Object.assign(parameters, {
      coloring: clone(layer.coloring),
      count: layer.count,
      jitter: layer.jitter,
      missingRate: layer.missingRate,
      placement: layer.placement,
      placementSeed: layer.placementSeed,
      radius: layer.radius,
    });
  } else if (layer.kind === "branch") {
    presetKind = "branch";
    Object.assign(parameters, {
      branchCount: layer.branchCount,
      starsPerBranch: layer.starsPerBranch,
      thickness: layer.thickness,
      upwardBias: layer.upwardBias,
    });
  } else {
    presetKind = "child";
    Object.assign(parameters, {
      childDelay: layer.delay,
      childPlacement: layer.placement,
      childScale: layer.scale,
      childWaveDelay: layer.waveDelay,
      count: layer.count,
    });
  }
  return { ...base, authoringMode: "preset", parameters, presetKind };
}

export function migrateV3ToV4(design: FireworkDesignV3): FireworkDesignV4 {
  return {
    ...clone(design),
    layers: design.layers.map(migrateLayer),
    legacyIntent: clone(design),
    schemaVersion: FIREWORK_DESIGN_V4_SCHEMA_VERSION,
  };
}

export function ensureFireworkDesignV4(
  design: AnyFireworkDesign,
): FireworkDesignV4 {
  if (design.schemaVersion === FIREWORK_DESIGN_V4_SCHEMA_VERSION) {
    return clone(design);
  }
  const v3 =
    design.schemaVersion === FIREWORK_DESIGN_V3_SCHEMA_VERSION
      ? design
      : migrateV2ToV3(design);
  return migrateV3ToV4(v3);
}

export function resolveLayerIntent(intent: LayerIntentV4): FireworkLayer {
  const base = {
    defaultStarId: intent.defaultStarId,
    ...(intent.effectTiming
      ? { effectTiming: clone(intent.effectTiming) }
      : undefined),
    id: intent.id,
    ignitionOffset: intent.ignitionOffset,
    locked: intent.locked,
    name: intent.name,
    radialSpeedScale: intent.radialSpeedScale,
    visible: intent.visible,
  };
  if (intent.authoringMode === "manual") {
    return {
      ...base,
      coloring: { mode: "selection" },
      count: Math.max(intent.points.length, 1),
      jitter: 0,
      kind: "spherical",
      missingRate: 0,
      overrides:
        intent.points.length === 0
          ? [{ index: 0, removed: true }]
          : intent.points.map((point, index) => ({
              ...(point.effectPhase === undefined
                ? undefined
                : { effectPhase: point.effectPhase }),
              index,
              position: clone(point.position),
              starId: point.starId,
            })),
      placement: "manual",
      placementSeed: 1,
      radius: 1,
    };
  }
  if (intent.authoringMode === "pattern") {
    const positions = createPatternRecipePoints(intent.pattern).map(
      (point) => point.position,
    );
    return {
      ...base,
      coloring: { mode: "layer" },
      count: Math.max(positions.length, 1),
      jitter: 0,
      kind: "spherical",
      missingRate: 0,
      overrides: positions.map((position, index) => ({ index, position })),
      placement: "manual",
      placementSeed: 1,
      radius: intent.pattern.scale,
    };
  }
  const { parameters } = intent;
  if (intent.presetKind === "branch") {
    return {
      ...base,
      branchCount: parameters.branchCount,
      kind: "branch",
      starsPerBranch: parameters.starsPerBranch,
      thickness: parameters.thickness,
      upwardBias: parameters.upwardBias,
    };
  }
  if (intent.presetKind === "child") {
    return {
      ...base,
      count: parameters.count,
      delay: parameters.childDelay,
      kind: "child",
      placement: parameters.childPlacement,
      scale: parameters.childScale,
      waveDelay: parameters.childWaveDelay,
    };
  }
  return {
    ...base,
    coloring: clone(parameters.coloring),
    count: parameters.count,
    jitter: parameters.jitter,
    kind: "spherical",
    missingRate: parameters.missingRate,
    overrides: [],
    placement: parameters.placement,
    placementSeed: parameters.placementSeed,
    radius: parameters.radius,
  };
}

export function resolveFireworkDesignV4(
  design: FireworkDesignV4,
): FireworkDesignV3 {
  return resolveCurrentIntent(design);
}

export interface MigrationComparison {
  changedLayerIds: string[];
  currentLayerCount: number;
  hasLegacyIntent: boolean;
  legacyLayerCount: number;
  matchingLayerIds: string[];
}

/**
 * Resolves the editable v4 document into the runtime compatibility shape.
 * `legacyIntent` is deliberately excluded: it is a migration reference, not
 * the execution source of truth.
 */
export function resolveCurrentIntent(
  design: FireworkDesignV4,
): FireworkDesignV3 {
  const resolved = clone(design) as unknown as FireworkDesignV3;
  delete (resolved as unknown as Record<string, unknown>).legacyIntent;
  resolved.derivationVersion = CURRENT_DERIVATION_VERSION;
  resolved.layers = design.layers.map(resolveLayerIntent);
  resolved.schemaVersion = FIREWORK_DESIGN_V3_SCHEMA_VERSION;
  return resolved;
}

/** Keeps migration comparison available without allowing it to affect play. */
export function compareLegacyEnvelope(
  design: FireworkDesignV4,
  resolved: FireworkDesignV3 = resolveCurrentIntent(design),
): MigrationComparison {
  const legacyLayers = design.legacyIntent?.layers ?? [];
  const legacyById = new Map(legacyLayers.map((layer) => [layer.id, layer]));
  const matchingLayerIds: string[] = [];
  const changedLayerIds: string[] = [];

  resolved.layers.forEach((layer) => {
    const legacy = legacyById.get(layer.id);
    if (legacy && JSON.stringify(legacy) === JSON.stringify(layer)) {
      matchingLayerIds.push(layer.id);
    } else {
      changedLayerIds.push(layer.id);
    }
  });

  return {
    changedLayerIds,
    currentLayerCount: resolved.layers.length,
    hasLegacyIntent: Boolean(design.legacyIntent),
    legacyLayerCount: legacyLayers.length,
    matchingLayerIds,
  };
}
