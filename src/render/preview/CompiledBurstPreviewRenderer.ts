import {
  compileFireworkDesign,
  createCompiledStarParticle,
  type CompiledBurstPlan,
  type CompiledStar,
} from "../../core/burst";
import {
  advanceBurstParticle,
  BURST_PARTICLE_ENVIRONMENT,
  evaluateVirtualStarAppearance,
  type VirtualStarTerminalState,
  type Vector3Value,
} from "../../core/particle";
import type { AnyFireworkDesign } from "../../data";
import { RENEWAL3_PREVIEW_SEED } from "../../app/renewal3Contracts";

export const MAX_PREVIEW_STARS = 256;
const MINIMUM_TRAJECTORY_FRAME_COUNT = 10;
const MAXIMUM_TRAJECTORY_FRAME_COUNT = 48;

interface PreviewStarSource {
  additionalDelay: number;
  compiled: CompiledStar;
  inheritedVelocity: Vector3Value;
  origin: Vector3Value;
  sourceIndex: number;
}

export interface PreviewTrajectoryPoint extends Vector3Value {
  color: number;
  intensity: number;
  lightMultiplier: number;
  secondaryScale: number;
  terminalState: VirtualStarTerminalState;
  time: number;
  visible: boolean;
}

export interface CompiledPreviewStar {
  compiledId: string;
  layerID: string;
  sourceIndex: number;
  trajectory: PreviewTrajectoryPoint[];
}

export interface CompiledBurstPreviewModel {
  duration: number;
  layerCount: number;
  plan: CompiledBurstPlan;
  sampledStars: CompiledPreviewStar[];
  seed: number;
  totalStarCount: number;
}

function allStarSources(plan: CompiledBurstPlan): PreviewStarSource[] {
  const sources: PreviewStarSource[] = plan.stars.map(
    (compiled, sourceIndex) => ({
      additionalDelay: 0,
      compiled,
      inheritedVelocity: { x: 0, y: 0, z: 0 },
      origin: { x: 0, y: 0, z: 0 },
      sourceIndex,
    }),
  );
  for (const child of plan.childBursts) {
    const origin = {
      x: child.initialVelocity.x * child.delay,
      y:
        child.initialVelocity.y * child.delay -
        0.5 * BURST_PARTICLE_ENVIRONMENT.gravity * 0.34 * child.delay ** 2,
      z: child.initialVelocity.z * child.delay,
    };
    for (const compiled of child.stars) {
      sources.push({
        additionalDelay: child.delay,
        compiled,
        inheritedVelocity: child.initialVelocity,
        origin,
        sourceIndex: sources.length,
      });
    }
  }
  return sources;
}

function extremaIndices(group: PreviewStarSource[]): number[] {
  if (group.length === 0) return [];
  const vectorValues = (source: PreviewStarSource): number[] => [
    source.compiled.initialVelocity.x,
    source.compiled.initialVelocity.y,
    source.compiled.initialVelocity.z,
  ];
  const indices = new Set([0, group.length - 1]);
  for (let axis = 0; axis < 3; axis += 1) {
    let minimum = 0;
    let maximum = 0;
    for (let index = 1; index < group.length; index += 1) {
      const value = vectorValues(group[index])[axis];
      if (value < vectorValues(group[minimum])[axis]) minimum = index;
      if (value > vectorValues(group[maximum])[axis]) maximum = index;
    }
    indices.add(minimum);
    indices.add(maximum);
  }
  return [...indices];
}

/** Deterministic layer-stratified selection with extrema retained first. */
export function sampleCompiledStars(
  plan: CompiledBurstPlan,
  maximum = MAX_PREVIEW_STARS,
): PreviewStarSource[] {
  const sources = allStarSources(plan);
  const limit = Math.max(Math.trunc(maximum), 0);
  if (sources.length <= limit) return sources;
  if (limit === 0) return [];

  const groups = new Map<string, PreviewStarSource[]>();
  for (const source of sources) {
    const group = groups.get(source.compiled.layerID) ?? [];
    group.push(source);
    groups.set(source.compiled.layerID, group);
  }

  const selected = new Set<number>();
  for (const group of groups.values()) {
    for (const groupIndex of extremaIndices(group)) {
      if (selected.size >= limit) break;
      selected.add(group[groupIndex].sourceIndex);
    }
    if (selected.size >= limit) break;
  }

  const remaining = limit - selected.size;
  if (remaining > 0) {
    for (let slot = 0; slot < remaining; slot += 1) {
      const index = Math.min(
        Math.floor(((slot + 0.5) / remaining) * sources.length),
        sources.length - 1,
      );
      selected.add(sources[index].sourceIndex);
    }
  }
  for (const source of sources) {
    if (selected.size >= limit) break;
    selected.add(source.sourceIndex);
  }
  return sources.filter((source) => selected.has(source.sourceIndex));
}

export function buildCompiledStarTrajectory(
  source: PreviewStarSource,
  design: AnyFireworkDesign,
  duration: number,
): PreviewTrajectoryPoint[] {
  const particle = createCompiledStarParticle(
    source.compiled,
    design,
    source.origin,
    source.inheritedVelocity,
  );
  particle.age -= source.additionalDelay;
  const points: PreviewTrajectoryPoint[] = [];
  const frequency =
    source.compiled.definition.effectProfile?.light?.mode === "strobe"
      ? (source.compiled.definition.effectProfile.light.frequencyHz ?? 6)
      : 0;
  const frameCount = frequency
    ? Math.min(
        Math.max(
          Math.ceil(duration * frequency * 4),
          MINIMUM_TRAJECTORY_FRAME_COUNT,
        ),
        MAXIMUM_TRAJECTORY_FRAME_COUNT,
      )
    : MINIMUM_TRAJECTORY_FRAME_COUNT;
  let elapsed = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const target = (frame / (frameCount - 1)) * duration;
    while (elapsed + 0.000_001 < target) {
      const delta = Math.min(target - elapsed, 0.05);
      advanceBurstParticle(particle, delta, BURST_PARTICLE_ENVIRONMENT);
      elapsed += delta;
    }
    const parentVisible = particle.age >= 0 && particle.age < particle.lifetime;
    const secondary = source.compiled.definition.effectProfile?.secondary;
    const secondaryTrigger =
      particle.lifetime * (secondary?.triggerTime ?? 0.9);
    const secondaryAge = particle.age - secondaryTrigger;
    const secondaryScale =
      secondary &&
      secondary.mode !== "none" &&
      secondaryAge >= 0 &&
      secondaryAge <= 0.72
        ? Math.pow(1 - secondaryAge / 0.72, 1.2) *
          Math.min((secondary.count ?? 0) / 4, 1.4)
        : 0;
    const visible = parentVisible || secondaryScale > 0;
    const appearance = evaluateVirtualStarAppearance({
      ageSeconds: particle.age,
      colorStages: source.compiled.definition.colorStages,
      effectPhase: source.compiled.effectPhase,
      effectProfile: source.compiled.definition.effectProfile,
      effectSeed: source.compiled.effectSeed,
      legacyFlicker: source.compiled.definition.flicker,
      lifetimeSeconds: particle.lifetime,
    });
    points.push({
      x: particle.position.x + appearance.motionOffset.x,
      y: particle.position.y + appearance.motionOffset.y,
      z: particle.position.z + appearance.motionOffset.z,
      color: appearance.color,
      intensity: parentVisible
        ? appearance.intensity * appearance.lightMultiplier
        : secondaryScale * 0.86,
      lightMultiplier: parentVisible ? appearance.lightMultiplier : 0,
      secondaryScale,
      terminalState: appearance.terminalState,
      time: target,
      visible,
    });
  }
  return points;
}

export function buildCompiledBurstPreviewModel(
  design: AnyFireworkDesign,
  seed = RENEWAL3_PREVIEW_SEED,
): CompiledBurstPreviewModel {
  const plan = compileFireworkDesign(design, seed);
  const sources = sampleCompiledStars(plan);
  const duration = Math.min(
    Math.max(
      ...sources.map(
        (source) =>
          source.additionalDelay +
          source.compiled.timingOffset +
          source.compiled.definition.burnDuration *
            source.compiled.lifetimeScale +
          (source.compiled.definition.effectProfile?.secondary?.mode &&
          source.compiled.definition.effectProfile.secondary.mode !== "none"
            ? 0.72
            : 0),
      ),
      1.8,
    ),
    3.6,
  );
  return {
    duration,
    layerCount: new Set(sources.map((source) => source.compiled.layerID)).size,
    plan,
    sampledStars: sources.map((source) => ({
      compiledId: source.compiled.id,
      layerID: source.compiled.layerID,
      sourceIndex: source.sourceIndex,
      trajectory: buildCompiledStarTrajectory(source, design, duration),
    })),
    seed,
    totalStarCount:
      plan.stars.length +
      plan.childBursts.reduce((sum, child) => sum + child.stars.length, 0),
  };
}

function colorToCSS(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function projectedTrajectories(model: CompiledBurstPreviewModel): Array<{
  colors: string[];
  id: string;
  opacity: string[];
  radius: string[];
  x: string[];
  y: string[];
}> {
  const allPoints = model.sampledStars.flatMap((star) => star.trajectory);
  const extent = Math.max(
    ...allPoints.flatMap((point) => [Math.abs(point.x), Math.abs(point.y)]),
    1,
  );
  const scale = 68 / extent;
  return model.sampledStars.map((star) => ({
    colors: star.trajectory.map((point) => colorToCSS(point.color)),
    id: star.compiledId,
    opacity: star.trajectory.map((point) =>
      Math.min(Math.max(point.intensity, 0), 1).toFixed(2),
    ),
    radius: star.trajectory.map((point) =>
      (1.35 + point.secondaryScale * 3.2).toFixed(2),
    ),
    x: star.trajectory.map((point) => (100 + point.x * scale).toFixed(2)),
    y: star.trajectory.map((point) => (82 - point.y * scale).toFixed(2)),
  }));
}

export function renderCompiledBurstPreview(
  model: CompiledBurstPreviewModel,
  running: boolean,
  revision: number,
): string {
  const trajectories = projectedTrajectories(model);
  const stars = trajectories
    .map((trajectory) => {
      const index = running ? 0 : Math.floor(trajectory.x.length * 0.55);
      const animations = running
        ? `<animate attributeName="cx" values="${trajectory.x.join(";")}" dur="${model.duration}s" repeatCount="indefinite" />
          <animate attributeName="cy" values="${trajectory.y.join(";")}" dur="${model.duration}s" repeatCount="indefinite" />
          <animate attributeName="fill" values="${trajectory.colors.join(";")}" dur="${model.duration}s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="${trajectory.opacity.join(";")}" dur="${model.duration}s" repeatCount="indefinite" />
          <animate attributeName="r" values="${trajectory.radius.join(";")}" dur="${model.duration}s" repeatCount="indefinite" />`
        : "";
      return `<circle class="compiled-preview-star" data-compiled-star="${trajectory.id}" cx="${trajectory.x[index]}" cy="${trajectory.y[index]}" r="${trajectory.radius[index]}" fill="${trajectory.colors[index]}" opacity="${trajectory.opacity[index]}">${animations}</circle>`;
    })
    .join("");
  return `<svg viewBox="0 0 200 164" class="compiled-burst-preview ${running ? "is-running" : "is-paused"}" data-preview-revision="${revision}" role="img" aria-label="${model.totalStarCount}星の打上結果プレビュー"><circle cx="100" cy="82" r="68" class="compiled-preview-guide" />${stars}</svg>`;
}
