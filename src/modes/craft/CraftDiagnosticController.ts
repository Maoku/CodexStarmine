import type {
  FireworkDesign,
  FireworkLayer,
  VirtualStarPreset,
} from "../../data";
import { deriveVirtualBehavior } from "../../core/burst";

export interface DiagnosticColorStep {
  color: number;
  label: string;
  time: number;
}

export interface DiagnosticDirection {
  label: string;
  value: number;
}

export interface DiagnosticTiming {
  color: number;
  duration: number;
  label: string;
  start: number;
}

export interface EditorDiagnostic {
  colors: DiagnosticColorStep[];
  directions: DiagnosticDirection[];
  estimatedCost: {
    childBurstCount: number;
    effectTrailVertexEstimate?: number;
    maximumParticles: number;
    secondaryParticleCount?: number;
    smokeEmitterEstimate?: number;
    starCount: number;
    terminalSparkCount?: number;
    trailCount: number;
  };
  timings: DiagnosticTiming[];
  warnings: string[];
}

function layerCount(layer: FireworkLayer): number {
  if (layer.kind === "spherical") return layer.count;
  if (layer.kind === "pattern") return layer.points.length;
  if (layer.kind === "branch") {
    return layer.branchCount * layer.starsPerBranch;
  }
  return 0;
}

function layerDefinitionIDs(layer: FireworkLayer): string[] {
  if (layer.kind === "spherical") {
    return [layer.defaultStarId, layer.coloring.alternateStarId].filter(
      (value): value is string => Boolean(value),
    );
  }
  if (layer.kind === "pattern") {
    return [layer.defaultStarId, ...layer.groups.map((group) => group.starId)];
  }
  return [layer.defaultStarId];
}

function uniqueDefinitions(
  design: FireworkDesign,
  layer: FireworkLayer,
): VirtualStarPreset[] {
  return [...new Set(layerDefinitionIDs(layer))]
    .map((id) => design.starDefinitions[id])
    .filter((value): value is VirtualStarPreset => Boolean(value));
}

function layerDensity(layer: FireworkLayer): number {
  if (layer.kind === "spherical") return Math.min(layer.count / 900, 1);
  if (layer.kind === "pattern") return Math.min(layer.points.length / 320, 1);
  if (layer.kind === "branch") {
    return Math.min((layer.branchCount * layer.starsPerBranch) / 320, 1);
  }
  return Math.min(layer.count / 48, 1);
}

function derivedBehavior(
  design: FireworkDesign,
  layer: FireworkLayer,
  star: VirtualStarPreset,
) {
  if (design.schemaVersion !== 3) return undefined;
  return deriveVirtualBehavior({
    assemblySeed: design.assemblySeed,
    derivationVersion: design.derivationVersion,
    layer,
    localDensity: layerDensity(layer),
    normalizedPosition: {
      x: layer.kind === "spherical" ? layer.radius : 1,
      y: 0,
      z: 0,
    },
    sizeClass: design.sizeClass,
    star,
  });
}

export function buildEditorDiagnostic(
  design: FireworkDesign,
): EditorDiagnostic {
  const visibleLayers = design.layers.filter((layer) => layer.visible);
  const colors: DiagnosticColorStep[] = [];
  const timings: DiagnosticTiming[] = [];
  const warnings: string[] = [];
  let starCount = 0;
  let childBurstCount = 0;
  let childStars = 0;
  let effectTrailVertexEstimate = 0;
  let secondaryParticleCount = 0;
  let smokeEmitterEstimate = 0;
  let trailCount = 0;
  let terminalSparkCount = 0;

  visibleLayers.forEach((layer) => {
    const count = layerCount(layer);
    starCount += count;
    if (layer.kind === "child") {
      childBurstCount += layer.count;
      childStars += layer.count * 24;
    }
    const definitions = uniqueDefinitions(design, layer);
    definitions.forEach((definition) => {
      const effectStarCount = layer.kind === "child" ? layer.count * 24 : count;
      const behavior = derivedBehavior(design, layer, definition);
      definition.colorStages.forEach((stage) => {
        colors.push({
          color: stage.color,
          label: `${layer.name}・${definition.displayName}`,
          time:
            (behavior?.ignitionOffset ?? layer.ignitionOffset) +
            stage.normalizedTime * definition.burnDuration,
        });
      });
      if (definition.trailLifetime > 0.24) trailCount += count;
      if (definition.effectProfile) {
        const secondary = definition.effectProfile.secondary;
        if (secondary && secondary.mode !== "none") {
          secondaryParticleCount +=
            effectStarCount * Math.round(secondary.count ?? 0);
        }
        const terminal = definition.effectProfile.light?.terminal;
        if (terminal && terminal.mode !== "none") {
          terminalSparkCount +=
            effectStarCount * Math.round(terminal.sparkleCount ?? 0);
        }
        if (definition.trailLifetime > 0.14) {
          effectTrailVertexEstimate +=
            effectStarCount *
            Math.max(Math.round(3 + definition.trailLifetime * 9) - 1, 1) *
            2;
        }
        if (definition.smokeAmount > 0) {
          smokeEmitterEstimate += effectStarCount;
        }
      }
      timings.push({
        color:
          definition.colorStages[1]?.color ??
          definition.colorStages[0]?.color ??
          0xffffff,
        duration: definition.burnDuration,
        label: layer.name,
        start:
          (behavior?.ignitionOffset ?? layer.ignitionOffset) +
          (layer.kind === "child" ? (behavior?.childDelay ?? layer.delay) : 0),
      });
    });
  });

  const maximumParticles =
    starCount + childStars + secondaryParticleCount + terminalSparkCount;
  if (maximumParticles > 6_000) {
    warnings.push(
      "実行上限6,000星を超えます。星数または子花数を減らしてください。",
    );
  } else if (maximumParticles > 2_000) {
    warnings.push("2,000星を超える高負荷設計です。自動簡略化を推奨します。");
  }
  if (trailCount > 1_200) {
    warnings.push(
      "尾の同時描画が多いため、尾の短い仮想星への置換候補があります。",
    );
  }
  for (const layer of visibleLayers) {
    if (layer.kind === "spherical" && layer.count > 0) {
      const definition = design.starDefinitions[layer.defaultStarId];
      const behavior = definition
        ? derivedBehavior(design, layer, definition)
        : undefined;
      const effectiveMissing =
        layer.missingRate +
        (behavior?.missingRate ?? design.realism.missingRate);
      if (effectiveMissing > 0.25) {
        warnings.push(
          `${layer.name}は欠け率が高く、輪が途切れる可能性があります。`,
        );
      }
      if (layer.count > 720) {
        warnings.push(
          `${layer.name}は過密です。均等配置の間隔を広げてください。`,
        );
      }
    }
    if (layer.kind === "pattern") {
      const definition = design.starDefinitions[layer.defaultStarId];
      const behavior = definition
        ? derivedBehavior(design, layer, definition)
        : undefined;
      if (
        (behavior?.rotationJitter ?? layer.rotationJitter) <=
        (behavior?.allowedAngle ?? layer.allowedAngle)
      ) {
        continue;
      }
      warnings.push(
        `${layer.name}は許容角度を超えて向きが崩れる可能性があります。`,
      );
    }
  }

  const directionValues = visibleLayers.reduce(
    (result, layer) => {
      const count = layer.kind === "child" ? layer.count : layerCount(layer);
      if (layer.kind === "pattern") result.front += count;
      else if (layer.kind === "branch") result.up += count;
      else {
        result.left += Math.ceil(count / 4);
        result.right += Math.floor(count / 4);
        result.up += Math.ceil(count / 4);
        result.depth += Math.floor(count / 4);
      }
      return result;
    },
    { depth: 0, front: 0, left: 0, right: 0, up: 0 },
  );

  return {
    colors: colors.sort((a, b) => a.time - b.time),
    directions: [
      { label: "左", value: directionValues.left },
      { label: "上", value: directionValues.up },
      { label: "正面", value: directionValues.front },
      { label: "右", value: directionValues.right },
      { label: "奥行", value: directionValues.depth },
    ],
    estimatedCost: {
      childBurstCount,
      ...(secondaryParticleCount > 0 ||
      terminalSparkCount > 0 ||
      effectTrailVertexEstimate > 0
        ? {
            effectTrailVertexEstimate,
            secondaryParticleCount,
            smokeEmitterEstimate,
            terminalSparkCount,
          }
        : undefined),
      maximumParticles,
      starCount,
      trailCount,
    },
    timings: timings.sort((a, b) => a.start - b.start),
    warnings,
  };
}

export function compareDiagnostics(
  a: EditorDiagnostic,
  b: EditorDiagnostic,
): { label: string; a: string; b: string }[] {
  const lastTime = (diagnostic: EditorDiagnostic) =>
    Math.max(
      ...diagnostic.timings.map((item) => item.start + item.duration),
      0,
    );
  return [
    {
      label: "仮想星",
      a: String(a.estimatedCost.maximumParticles),
      b: String(b.estimatedCost.maximumParticles),
    },
    {
      label: "色列",
      a: `${new Set(a.colors.map((item) => item.color)).size}色`,
      b: `${new Set(b.colors.map((item) => item.color)).size}色`,
    },
    {
      label: "方向区分",
      a: `${a.directions.filter((item) => item.value > 0).length}方向`,
      b: `${b.directions.filter((item) => item.value > 0).length}方向`,
    },
    {
      label: "発光終了",
      a: `${lastTime(a).toFixed(2)}秒`,
      b: `${lastTime(b).toFixed(2)}秒`,
    },
  ];
}
