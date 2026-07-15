export type FireworkFamily = "warimono" | "pokamono" | "hanwarimono";
export type FireworkPattern =
  "chrysanthemum" | "peony" | "crown" | "palm" | "senrin" | "heart";
export type SizeClass = "small" | "medium" | "large";
export type BurstShape = "sphere" | "palm" | "heart" | "children";
export type AscentEffect = "gold" | "silver" | "none";

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
  schemaVersion: 2;
  starDefinitions: Record<string, VirtualStarPreset>;
  themeColors: number[];
}

export type FireworkDesign = FireworkDesignV2;

export function isFireworkDesignV2(value: unknown): value is FireworkDesignV2 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FireworkDesignV2>;
  return (
    candidate.schemaVersion === 2 &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.layers) &&
    Boolean(candidate.starDefinitions) &&
    typeof candidate.assemblySeed === "number"
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
