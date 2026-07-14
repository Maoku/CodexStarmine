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

export interface FireworkDesign {
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
