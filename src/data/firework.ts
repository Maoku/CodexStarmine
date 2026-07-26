export type FireworkFamily = "warimono" | "pokamono" | "hanwarimono";
export type FireworkPattern =
  | "chrysanthemum"
  | "peony"
  | "crown"
  | "palm"
  | "senrin"
  | "heart"
  | "willow"
  | "bee"
  | "hiyusei"
  | "hanarai"
  | "kaleidoscope"
  | "saturn"
  | "butterfly"
  | "kowari";
export const FIREWORK_PATTERN_LABELS = {
  chrysanthemum: "菊",
  peony: "牡丹",
  crown: "冠",
  palm: "椰子",
  senrin: "千輪",
  heart: "型物・ハート",
  willow: "柳",
  bee: "蜂",
  hiyusei: "飛遊星",
  hanarai: "花雷",
  kaleidoscope: "万華鏡",
  saturn: "型物・土星",
  butterfly: "型物・蝶々",
  kowari: "小割",
} as const satisfies Record<FireworkPattern, string>;
export type SizeClass = "small" | "medium" | "large";
export type BurstShape = "sphere" | "palm" | "heart" | "children";
export type AscentEffect = "gold" | "silver" | "none";

export const FIREWORK_DESIGN_V2_SCHEMA_VERSION = 2 as const;
export const FIREWORK_DESIGN_V3_SCHEMA_VERSION = 3 as const;
export const FIREWORK_DESIGN_V4_SCHEMA_VERSION = 4 as const;
export const CURRENT_DERIVATION_VERSION = 1 as const;

export interface ColorStage {
  color: number;
  intensity: number;
  normalizedTime: number;
  trailColor: number;
}

export interface CoreLayer {
  color: number;
  radius: number;
}

export interface ChildBurst {
  count: number;
  delay: number;
  radius: number;
}

export interface TrailStyle {
  length: number;
  sparkle: number;
  width: number;
}

export interface SoundProfile {
  crackle: number;
  lowEnd: number;
  volume: number;
}

export interface SmokeProfile {
  amount: number;
  lifetime: number;
}

/** The Phase 5 persistence contract. It remains readable for non-destructive migration. */
export interface FireworkDesignV1 {
  ascentEffect: AscentEffect;
  burnDuration: number;
  burstShape: BurstShape;
  burstVelocity: number;
  childBursts: ChildBurst[];
  colorStages: ColorStage[];
  coreLayers: CoreLayer[];
  drag: number;
  family: FireworkFamily;
  gravityScale: number;
  id: string;
  name: string;
  particleDensity: number;
  pattern: FireworkPattern;
  sizeClass: SizeClass;
  smokeProfile: SmokeProfile;
  soundProfile: SoundProfile;
  symmetry: number;
  trailStyle: TrailStyle;
  windResponse: number;
}

export type VirtualStarEmissionKind =
  "point" | "charcoalTail" | "goldTail" | "silverTail" | "flicker" | "child";

export interface VirtualStarEffectProfile {
  color?: {
    mode: "smooth" | "step";
    playback: "once" | "loop" | "pingPong";
    repeatCount?: number;
  };
  light?: {
    dutyCycle?: number;
    edgeSoftness?: number;
    frequencyHz?: number;
    mode: "continuous" | "strobe";
    phaseOffset?: number;
    terminal?: {
      duration: number;
      mode: "none" | "kouro" | "teka";
      sparkleCount?: number;
      strength: number;
    };
  };
  motion?: {
    amplitude?: number;
    frequencyHz?: number;
    mode: "ballistic" | "fallingLeaf" | "wander" | "spiral";
  };
  secondary?: {
    count?: number;
    mode: "none" | "spark" | "microBurst";
    speedScale?: number;
    triggerTime?: number;
  };
}

export interface VirtualStarPreset {
  brightness: number;
  burnDuration: number;
  colorStages: ColorStage[];
  displayName: string;
  drag: number;
  effectProfile?: VirtualStarEffectProfile;
  emissionKind: VirtualStarEmissionKind;
  flicker: number;
  gravityScale: number;
  id: string;
  smokeAmount: number;
  soundTag: "soft" | "crackle" | "deep";
  trailLifetime: number;
  trailWidth: number;
}

export type SpatialColorMode =
  "layer" | "latitude" | "longitude" | "alternating" | "selection";

export interface SpatialColoring {
  alternateStarId?: string;
  mode: SpatialColorMode;
}

export interface LayerBase {
  effectTiming?: LayerEffectTiming;
  id: string;
  ignitionOffset: number;
  kind: "spherical" | "pattern" | "branch" | "child";
  locked: boolean;
  name: string;
  radialSpeedScale: number;
  visible: boolean;
}

export interface StarPointOverride {
  effectPhase?: number;
  index: number;
  position?: { x: number; y: number; z: number };
  removed?: boolean;
  starId?: string;
}

export interface SphericalStarLayer extends LayerBase {
  kind: "spherical";
  coloring: SpatialColoring;
  count: number;
  defaultStarId: string;
  jitter: number;
  missingRate: number;
  overrides: StarPointOverride[];
  placement: "fibonacci" | "latitude" | "manual";
  placementSeed: number;
  radius: number;
}

export interface PatternPoint {
  groupId: string;
  x: number;
  y: number;
}

export interface PatternGroup {
  id: string;
  name: string;
  starId: string;
}

export interface PatternStarLayer extends LayerBase {
  kind: "pattern";
  allowedAngle: number;
  defaultStarId: string;
  depth: number;
  facingPolicy: "audience" | "venue" | "random";
  groups: PatternGroup[];
  orientationDegrees: number;
  points: PatternPoint[];
  rotationJitter: number;
  template: "heart" | "circle" | "smile" | "custom";
}

export interface BranchStarLayer extends LayerBase {
  kind: "branch";
  branchCount: number;
  defaultStarId: string;
  starsPerBranch: number;
  thickness: number;
  upwardBias: number;
}

export interface ChildBurstLayer extends LayerBase {
  kind: "child";
  colorOverride?: number;
  count: number;
  defaultStarId: string;
  delay: number;
  placement: "sphere" | "ring" | "pattern";
  scale: number;
  waveDelay: number;
}

export type FireworkLayer =
  SphericalStarLayer | PatternStarLayer | BranchStarLayer | ChildBurstLayer;

export interface BurstField {
  baseVelocity: number;
  drag: number;
  gravityScale: number;
  windResponse: number;
}

export interface DesignRealism {
  ignitionJitter: number;
  lifetimeJitter: number;
  missingRate: number;
  placementJitter: number;
  velocityJitter: number;
}

export interface LaunchVariation {
  ignition: number;
  lifetime: number;
  placement: number;
  velocity: number;
}

/**
 * Phase 6.5 design. Compatibility fields are deliberately retained while all
 * rendering is migrated to layers, so existing show/audio code can read v2.
 */
export interface FireworkDesignV2 extends FireworkDesignV1 {
  assemblySeed: number;
  burstField: BurstField;
  description: string;
  launchVariation: LaunchVariation;
  layers: FireworkLayer[];
  realism: DesignRealism;
  schemaVersion: typeof FIREWORK_DESIGN_V2_SCHEMA_VERSION;
  starDefinitions: Record<string, VirtualStarPreset>;
  themeColors: number[];
}

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

/**
 * Read-only compatibility view of the schema v2 persistence contract.
 *
 * Renewal code may read and migrate this shape, but new editing features must
 * not add fields to it. Runtime editing continues to use `FireworkDesign`
 * until the v3 intent document is introduced.
 */
export type FireworkDesignV2Compatibility = DeepReadonly<FireworkDesignV2>;

export interface LegacyLayerBehavior {
  allowedAngle?: number;
  delay?: number;
  id: string;
  ignitionOffset: number;
  orientationDegrees?: number;
  radialSpeedScale: number;
  rotationJitter?: number;
  waveDelay?: number;
}

/**
 * Values retained only to compare a migrated work with its schema-v2 launch.
 * Renewal editing and compilation never use this snapshot as user intent.
 */
export interface LegacyBehaviorSnapshot {
  burstField: BurstField;
  launchVariation: LaunchVariation;
  layers: LegacyLayerBehavior[];
  realism: DesignRealism;
  sourceSchemaVersion: typeof FIREWORK_DESIGN_V2_SCHEMA_VERSION;
}

/**
 * Phase 3 keeps the existing display/audio compatibility fields while the UI
 * is moved to intent-only editing. Low-level layer and launch values in this
 * shape are derived compatibility shadows and are ignored by the v3 compiler.
 */
export type IntentLayer = FireworkLayer;

export interface FireworkDesignV3 extends Omit<
  FireworkDesignV2,
  "layers" | "schemaVersion"
> {
  derivationVersion: typeof CURRENT_DERIVATION_VERSION;
  legacyBehavior?: LegacyBehaviorSnapshot;
  layers: IntentLayer[];
  schemaVersion: typeof FIREWORK_DESIGN_V3_SCHEMA_VERSION;
}

export type LayerAuthoringMode = "preset" | "pattern" | "manual";
export type EffectPhaseMapping =
  | "none"
  | "random"
  | "index"
  | "longitude"
  | "latitude"
  | "radius"
  | "group"
  | "manual";

export interface LayerEffectTiming {
  cycles: number;
  direction: "forward" | "reverse";
  mapping: EffectPhaseMapping;
  offset: number;
  spread: number;
}

export type PatternTemplate =
  "circle" | "heart" | "star" | "square" | "triangle" | "hexagon";
export type SectionPlane = "xy" | "xz" | "yz";
export type SectionRatio = 0.1 | 0.3 | 0.5 | 0.7 | 0.9;

export interface SectionRef {
  plane: SectionPlane;
  ratio: SectionRatio;
}

export interface LayerBaseV4 {
  defaultStarId: string;
  effectTiming?: LayerEffectTiming;
  id: string;
  ignitionOffset: number;
  locked: boolean;
  name: string;
  radialSpeedScale: number;
  visible: boolean;
}

export interface PresetLayerParameters {
  branchCount: number;
  childDelay: number;
  childPlacement: "sphere" | "ring" | "pattern";
  childScale: number;
  childWaveDelay: number;
  coloring: SpatialColoring;
  count: number;
  jitter: number;
  missingRate: number;
  placement: "fibonacci" | "latitude" | "manual";
  placementSeed: number;
  radius: number;
  starsPerBranch: number;
  thickness: number;
  upwardBias: number;
}

export interface PresetLayerIntent extends LayerBaseV4 {
  authoringMode: "preset";
  parameters: PresetLayerParameters;
  presetKind: "outer" | "core" | "child" | "branch";
}

export interface PatternLayerIntent extends LayerBaseV4 {
  authoringMode: "pattern";
  pattern: {
    density: number;
    rotationDegrees: number;
    scale: number;
    section: SectionRef;
    template: PatternTemplate;
  };
}

export interface ManualLayerPoint {
  effectPhase?: number;
  id: string;
  position: { x: number; y: number; z: number };
  section: SectionRef;
  starId: string;
}

export interface ManualLayerIntent extends LayerBaseV4 {
  authoringMode: "manual";
  points: ManualLayerPoint[];
}

export type LayerIntentV4 =
  PresetLayerIntent | PatternLayerIntent | ManualLayerIntent;

/**
 * Schema v4 stores editing intent. `legacyIntent` is a read-only migration
 * snapshot used until a migrated layer is intentionally edited as v4.
 */
export interface FireworkDesignV4 extends Omit<
  FireworkDesignV3,
  "layers" | "schemaVersion"
> {
  layers: LayerIntentV4[];
  legacyIntent?: FireworkDesignV3;
  schemaVersion: typeof FIREWORK_DESIGN_V4_SCHEMA_VERSION;
}

/** Runtime compatibility view used by the existing renderer during migration. */
export type FireworkDesign = FireworkDesignV2 | FireworkDesignV3;
export type AnyFireworkDesign = FireworkDesign | FireworkDesignV4;

export function isFireworkDesignV2(value: unknown): value is FireworkDesignV2 {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== FIREWORK_DESIGN_V2_SCHEMA_VERSION ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.assemblySeed !== "number" ||
    !["small", "medium", "large"].includes(String(value.sizeClass)) ||
    !Array.isArray(value.layers) ||
    !value.layers.every(isIntentLayer) ||
    !isRecord(value.starDefinitions) ||
    !Object.values(value.starDefinitions).every(isVirtualStarPreset) ||
    !hasNumberFields(value.burstField, [
      "baseVelocity",
      "drag",
      "gravityScale",
      "windResponse",
    ]) ||
    !hasNumberFields(value.launchVariation, [
      "ignition",
      "lifetime",
      "placement",
      "velocity",
    ]) ||
    !hasNumberFields(value.realism, [
      "ignitionJitter",
      "lifetimeJitter",
      "missingRate",
      "placementJitter",
      "velocityJitter",
    ])
  ) {
    return false;
  }
  const starDefinitions = value.starDefinitions;
  return value.layers.every((layer) =>
    Boolean(starDefinitions[(layer as IntentLayer).defaultStarId]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isVirtualStarPreset(value: unknown): value is VirtualStarPreset {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.displayName === "string" &&
    typeof value.brightness === "number" &&
    typeof value.burnDuration === "number" &&
    typeof value.drag === "number" &&
    typeof value.gravityScale === "number" &&
    (value.effectProfile === undefined ||
      isVirtualStarEffectProfile(value.effectProfile)) &&
    Array.isArray(value.colorStages) &&
    value.colorStages.every(
      (stage) =>
        isRecord(stage) &&
        typeof stage.color === "number" &&
        typeof stage.intensity === "number" &&
        typeof stage.normalizedTime === "number" &&
        typeof stage.trailColor === "number",
    )
  );
}

function isFiniteInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

export function isVirtualStarEffectProfile(
  value: unknown,
): value is VirtualStarEffectProfile {
  if (!isRecord(value)) return false;
  if (value.color !== undefined) {
    if (
      !isRecord(value.color) ||
      !["smooth", "step"].includes(String(value.color.mode)) ||
      !["once", "loop", "pingPong"].includes(String(value.color.playback)) ||
      (value.color.repeatCount !== undefined &&
        !isFiniteInRange(value.color.repeatCount, 1, 8))
    ) {
      return false;
    }
  }
  if (value.light !== undefined) {
    if (
      !isRecord(value.light) ||
      !["continuous", "strobe"].includes(String(value.light.mode)) ||
      (value.light.edgeSoftness !== undefined &&
        !isFiniteInRange(value.light.edgeSoftness, 0, 0.45)) ||
      (value.light.frequencyHz !== undefined &&
        !isFiniteInRange(value.light.frequencyHz, 0.5, 18)) ||
      (value.light.phaseOffset !== undefined &&
        !Number.isFinite(value.light.phaseOffset)) ||
      (value.light.dutyCycle !== undefined &&
        !isFiniteInRange(value.light.dutyCycle, 0.08, 0.92))
    ) {
      return false;
    }
    if (value.light.terminal !== undefined) {
      const terminal = value.light.terminal;
      if (
        !isRecord(terminal) ||
        !["none", "kouro", "teka"].includes(String(terminal.mode)) ||
        !isFiniteInRange(terminal.duration, 0.01, 0.2) ||
        !isFiniteInRange(terminal.strength, 0, 3) ||
        (terminal.sparkleCount !== undefined &&
          !isFiniteInRange(terminal.sparkleCount, 0, 6))
      ) {
        return false;
      }
    }
  }
  if (value.motion !== undefined) {
    if (
      !isRecord(value.motion) ||
      !["ballistic", "fallingLeaf", "wander", "spiral"].includes(
        String(value.motion.mode),
      ) ||
      (value.motion.amplitude !== undefined &&
        !isFiniteInRange(value.motion.amplitude, 0, 1)) ||
      (value.motion.frequencyHz !== undefined &&
        !isFiniteInRange(value.motion.frequencyHz, 0.1, 8))
    ) {
      return false;
    }
  }
  if (value.secondary !== undefined) {
    if (
      !isRecord(value.secondary) ||
      !["none", "spark", "microBurst"].includes(String(value.secondary.mode)) ||
      (value.secondary.count !== undefined &&
        !isFiniteInRange(value.secondary.count, 0, 6)) ||
      (value.secondary.speedScale !== undefined &&
        !isFiniteInRange(value.secondary.speedScale, 0, 3)) ||
      (value.secondary.triggerTime !== undefined &&
        !isFiniteInRange(value.secondary.triggerTime, 0.35, 1))
    ) {
      return false;
    }
  }
  return true;
}

function clampFinite(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : fallback;
}

export function normalizeVirtualStarEffectProfile(
  value: unknown,
): VirtualStarEffectProfile | undefined {
  if (!isRecord(value)) return undefined;
  const source: Record<string, unknown> = value;
  if (isVirtualStarEffectProfile(value)) return structuredClone(value);
  const profile: VirtualStarEffectProfile = {};
  if (isRecord(source.color)) {
    profile.color = {
      mode: source.color.mode === "step" ? "step" : "smooth",
      playback: ["loop", "pingPong"].includes(String(source.color.playback))
        ? (source.color.playback as "loop" | "pingPong")
        : "once",
      repeatCount: clampFinite(source.color.repeatCount, 1, 1, 8),
    };
  }
  if (isRecord(source.light)) {
    const light: NonNullable<VirtualStarEffectProfile["light"]> = {
      dutyCycle: clampFinite(source.light.dutyCycle, 0.5, 0.08, 0.92),
      edgeSoftness: clampFinite(source.light.edgeSoftness, 0.06, 0, 0.45),
      frequencyHz: clampFinite(source.light.frequencyHz, 6, 0.5, 18),
      mode: source.light.mode === "strobe" ? "strobe" : "continuous",
      phaseOffset: clampFinite(source.light.phaseOffset, 0, -1_000, 1_000),
    };
    if (isRecord(source.light.terminal)) {
      light.terminal = {
        duration: clampFinite(source.light.terminal.duration, 0.08, 0.01, 0.2),
        mode: ["kouro", "teka"].includes(String(source.light.terminal.mode))
          ? (source.light.terminal.mode as "kouro" | "teka")
          : "none",
        sparkleCount: Math.round(
          clampFinite(source.light.terminal.sparkleCount, 0, 0, 6),
        ),
        strength: clampFinite(source.light.terminal.strength, 1, 0, 3),
      };
    }
    profile.light = light;
  }
  if (isRecord(source.motion)) {
    profile.motion = {
      amplitude: clampFinite(source.motion.amplitude, 0.35, 0, 1),
      frequencyHz: clampFinite(source.motion.frequencyHz, 1, 0.1, 8),
      mode: ["fallingLeaf", "wander", "spiral"].includes(
        String(source.motion.mode),
      )
        ? (source.motion.mode as "fallingLeaf" | "wander" | "spiral")
        : "ballistic",
    };
  }
  if (isRecord(source.secondary)) {
    profile.secondary = {
      count: Math.round(clampFinite(source.secondary.count, 0, 0, 6)),
      mode: ["spark", "microBurst"].includes(String(source.secondary.mode))
        ? (source.secondary.mode as "spark" | "microBurst")
        : "none",
      speedScale: clampFinite(source.secondary.speedScale, 1, 0, 3),
      triggerTime: clampFinite(source.secondary.triggerTime, 0.9, 0.35, 1),
    };
  }
  return Object.keys(profile).length > 0 ? profile : undefined;
}

export function isLayerEffectTiming(
  value: unknown,
): value is LayerEffectTiming {
  return (
    isRecord(value) &&
    [
      "none",
      "random",
      "index",
      "longitude",
      "latitude",
      "radius",
      "group",
      "manual",
    ].includes(String(value.mapping)) &&
    ["forward", "reverse"].includes(String(value.direction)) &&
    isFiniteInRange(value.cycles, 1, 4) &&
    isFiniteInRange(value.spread, 0, 1) &&
    Number.isFinite(value.offset)
  );
}

export function normalizeLayerEffectTiming(
  value: unknown,
): LayerEffectTiming | undefined {
  if (!isRecord(value)) return undefined;
  const mappings: EffectPhaseMapping[] = [
    "none",
    "random",
    "index",
    "longitude",
    "latitude",
    "radius",
    "group",
    "manual",
  ];
  return {
    cycles: clampFinite(value.cycles, 1, 1, 4),
    direction: value.direction === "reverse" ? "reverse" : "forward",
    mapping: mappings.includes(value.mapping as EffectPhaseMapping)
      ? (value.mapping as EffectPhaseMapping)
      : "none",
    offset: clampFinite(value.offset, 0, -1_000, 1_000),
    spread: clampFinite(value.spread, 1, 0, 1),
  };
}

function hasNumberFields(
  value: unknown,
  fields: readonly string[],
): value is Record<string, number> {
  return (
    isRecord(value) && fields.every((field) => typeof value[field] === "number")
  );
}

function isLegacyBehaviorSnapshot(
  value: unknown,
): value is LegacyBehaviorSnapshot {
  if (!isRecord(value)) return false;
  return (
    value.sourceSchemaVersion === FIREWORK_DESIGN_V2_SCHEMA_VERSION &&
    hasNumberFields(value.burstField, [
      "baseVelocity",
      "drag",
      "gravityScale",
      "windResponse",
    ]) &&
    hasNumberFields(value.launchVariation, [
      "ignition",
      "lifetime",
      "placement",
      "velocity",
    ]) &&
    hasNumberFields(value.realism, [
      "ignitionJitter",
      "lifetimeJitter",
      "missingRate",
      "placementJitter",
      "velocityJitter",
    ]) &&
    Array.isArray(value.layers) &&
    value.layers.every(
      (layer) =>
        isRecord(layer) &&
        typeof layer.id === "string" &&
        typeof layer.ignitionOffset === "number" &&
        typeof layer.radialSpeedScale === "number",
    )
  );
}

function isIntentLayer(value: unknown): value is IntentLayer {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.defaultStarId !== "string" ||
    typeof value.ignitionOffset !== "number" ||
    typeof value.radialSpeedScale !== "number" ||
    typeof value.visible !== "boolean" ||
    typeof value.locked !== "boolean"
  ) {
    return false;
  }
  if (
    value.effectTiming !== undefined &&
    !isLayerEffectTiming(value.effectTiming)
  ) {
    return false;
  }
  if (value.kind === "spherical") {
    return (
      typeof value.count === "number" &&
      typeof value.radius === "number" &&
      Array.isArray(value.overrides)
    );
  }
  if (value.kind === "pattern") {
    return (
      typeof value.allowedAngle === "number" &&
      typeof value.orientationDegrees === "number" &&
      typeof value.rotationJitter === "number" &&
      Array.isArray(value.groups) &&
      Array.isArray(value.points)
    );
  }
  if (value.kind === "branch") {
    return (
      typeof value.branchCount === "number" &&
      typeof value.starsPerBranch === "number"
    );
  }
  if (value.kind === "child") {
    return (
      typeof value.count === "number" &&
      typeof value.delay === "number" &&
      typeof value.scale === "number" &&
      typeof value.waveDelay === "number"
    );
  }
  return false;
}

export function isFireworkDesignV3(value: unknown): value is FireworkDesignV3 {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== FIREWORK_DESIGN_V3_SCHEMA_VERSION ||
    value.derivationVersion !== CURRENT_DERIVATION_VERSION ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.assemblySeed !== "number" ||
    !["small", "medium", "large"].includes(String(value.sizeClass)) ||
    !Array.isArray(value.layers) ||
    !value.layers.every(isIntentLayer) ||
    !isRecord(value.starDefinitions) ||
    !Object.values(value.starDefinitions).every(isVirtualStarPreset) ||
    !hasNumberFields(value.burstField, [
      "baseVelocity",
      "drag",
      "gravityScale",
      "windResponse",
    ]) ||
    !hasNumberFields(value.launchVariation, [
      "ignition",
      "lifetime",
      "placement",
      "velocity",
    ]) ||
    !hasNumberFields(value.realism, [
      "ignitionJitter",
      "lifetimeJitter",
      "missingRate",
      "placementJitter",
      "velocityJitter",
    ]) ||
    (value.legacyBehavior !== undefined &&
      !isLegacyBehaviorSnapshot(value.legacyBehavior))
  ) {
    return false;
  }
  const starDefinitions = value.starDefinitions;
  return value.layers.every((layer) =>
    Boolean(starDefinitions[(layer as IntentLayer).defaultStarId]),
  );
}

function isSectionRef(value: unknown): value is SectionRef {
  return (
    isRecord(value) &&
    (value.plane === "xy" || value.plane === "xz" || value.plane === "yz") &&
    [0.1, 0.3, 0.5, 0.7, 0.9].includes(Number(value.ratio))
  );
}

function isLayerBaseV4(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.defaultStarId === "string" &&
    typeof value.ignitionOffset === "number" &&
    typeof value.radialSpeedScale === "number" &&
    typeof value.visible === "boolean" &&
    typeof value.locked === "boolean" &&
    (value.effectTiming === undefined ||
      isLayerEffectTiming(value.effectTiming))
  );
}

function isLayerIntentV4(value: unknown): value is LayerIntentV4 {
  if (!isRecord(value) || !isLayerBaseV4(value)) return false;
  if (value.authoringMode === "preset") {
    const parameters = value.parameters;
    return (
      ["outer", "core", "child", "branch"].includes(String(value.presetKind)) &&
      hasNumberFields(parameters, [
        "branchCount",
        "childDelay",
        "childScale",
        "childWaveDelay",
        "count",
        "jitter",
        "missingRate",
        "placementSeed",
        "radius",
        "starsPerBranch",
        "thickness",
        "upwardBias",
      ]) &&
      isRecord(parameters.coloring) &&
      ["layer", "latitude", "longitude", "alternating", "selection"].includes(
        String(parameters.coloring.mode),
      ) &&
      ["fibonacci", "latitude", "manual"].includes(
        String(parameters.placement),
      ) &&
      ["sphere", "ring", "pattern"].includes(String(parameters.childPlacement))
    );
  }
  if (value.authoringMode === "pattern") {
    return (
      isRecord(value.pattern) &&
      ["circle", "heart", "star", "square", "triangle", "hexagon"].includes(
        String(value.pattern.template),
      ) &&
      isSectionRef(value.pattern.section) &&
      hasNumberFields(value.pattern, ["density", "rotationDegrees", "scale"])
    );
  }
  if (value.authoringMode === "manual") {
    return (
      Array.isArray(value.points) &&
      value.points.every(
        (point) =>
          isRecord(point) &&
          typeof point.id === "string" &&
          typeof point.starId === "string" &&
          (point.effectPhase === undefined ||
            isFiniteInRange(point.effectPhase, 0, 1)) &&
          isSectionRef(point.section) &&
          hasNumberFields(point.position, ["x", "y", "z"]),
      )
    );
  }
  return false;
}

export function isFireworkDesignV4(value: unknown): value is FireworkDesignV4 {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== FIREWORK_DESIGN_V4_SCHEMA_VERSION ||
    value.derivationVersion !== CURRENT_DERIVATION_VERSION ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.assemblySeed !== "number" ||
    !["small", "medium", "large"].includes(String(value.sizeClass)) ||
    !Array.isArray(value.layers) ||
    !value.layers.every(isLayerIntentV4) ||
    !isRecord(value.starDefinitions) ||
    !Object.values(value.starDefinitions).every(isVirtualStarPreset) ||
    !hasNumberFields(value.burstField, [
      "baseVelocity",
      "drag",
      "gravityScale",
      "windResponse",
    ]) ||
    !hasNumberFields(value.launchVariation, [
      "ignition",
      "lifetime",
      "placement",
      "velocity",
    ]) ||
    !hasNumberFields(value.realism, [
      "ignitionJitter",
      "lifetimeJitter",
      "missingRate",
      "placementJitter",
      "velocityJitter",
    ]) ||
    (value.legacyBehavior !== undefined &&
      !isLegacyBehaviorSnapshot(value.legacyBehavior)) ||
    (value.legacyIntent !== undefined &&
      !isFireworkDesignV3(value.legacyIntent))
  ) {
    return false;
  }
  const starDefinitions = value.starDefinitions;
  return value.layers.every((layer) =>
    Boolean(starDefinitions[(layer as LayerIntentV4).defaultStarId]),
  );
}

export interface ShowCue {
  fireworkDesignID: string;
  id: string;
  launchAngle: number;
  launcherLane: number;
  sizePreset: SizeClass;
  targetHeight: number;
  time: number;
  timingVariation: number;
}

export interface ShowPlan {
  cues: ShowCue[];
  duration: number;
  id: string;
  title: string;
}
