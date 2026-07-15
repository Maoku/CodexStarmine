export type FireworkFamily = "warimono" | "pokamono" | "hanwarimono";
export type FireworkPattern =
  "chrysanthemum" | "peony" | "crown" | "palm" | "senrin" | "heart";
export type SizeClass = "small" | "medium" | "large";
export type BurstShape = "sphere" | "palm" | "heart" | "children";
export type AscentEffect = "gold" | "silver" | "none";

export const FIREWORK_DESIGN_V2_SCHEMA_VERSION = 2 as const;
export const FIREWORK_DESIGN_V3_SCHEMA_VERSION = 3 as const;
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

export interface VirtualStarPreset {
  brightness: number;
  burnDuration: number;
  colorStages: ColorStage[];
  displayName: string;
  drag: number;
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
  id: string;
  ignitionOffset: number;
  kind: "spherical" | "pattern" | "branch" | "child";
  locked: boolean;
  name: string;
  radialSpeedScale: number;
  visible: boolean;
}

export interface StarPointOverride {
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

export type FireworkDesign = FireworkDesignV2 | FireworkDesignV3;

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
