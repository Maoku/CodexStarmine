import type { FireworkDesign } from "./firework";

export const CHRYSANTHEMUM_PRESET: FireworkDesign = {
  id: "preset-chrysanthemum",
  name: "変化菊",
  family: "warimono",
  pattern: "chrysanthemum",
  sizeClass: "medium",
  burstShape: "sphere",
  burstVelocity: 34,
  symmetry: 0.96,
  particleDensity: 180,
  coreLayers: [],
  childBursts: [],
  colorStages: [
    {
      normalizedTime: 0,
      color: 0xfff0b0,
      intensity: 1.25,
      trailColor: 0xffbb55,
    },
    {
      normalizedTime: 0.42,
      color: 0xff4c32,
      intensity: 1,
      trailColor: 0xd77b2f,
    },
    {
      normalizedTime: 0.74,
      color: 0x56e0a2,
      intensity: 0.72,
      trailColor: 0x967047,
    },
    {
      normalizedTime: 1,
      color: 0xeaf7ff,
      intensity: 0,
      trailColor: 0x3b3027,
    },
  ],
  trailStyle: { length: 0.86, width: 1, sparkle: 0.28 },
  burnDuration: 3.35,
  gravityScale: 1,
  drag: 0.48,
  windResponse: 0.62,
  soundProfile: { volume: 0.76, lowEnd: 0.68, crackle: 0.58 },
  smokeProfile: { amount: 0.58, lifetime: 8 },
};

export const PEONY_PRESET: FireworkDesign = {
  id: "preset-peony",
  name: "紅青牡丹",
  family: "warimono",
  pattern: "peony",
  sizeClass: "medium",
  burstShape: "sphere",
  burstVelocity: 37,
  symmetry: 0.94,
  particleDensity: 210,
  coreLayers: [],
  childBursts: [],
  colorStages: [
    {
      normalizedTime: 0,
      color: 0xfff4df,
      intensity: 1.35,
      trailColor: 0xffd4a0,
    },
    {
      normalizedTime: 0.12,
      color: 0xff365f,
      intensity: 1.08,
      trailColor: 0xff365f,
    },
    {
      normalizedTime: 0.68,
      color: 0x4c83ff,
      intensity: 0.78,
      trailColor: 0x4c83ff,
    },
    {
      normalizedTime: 1,
      color: 0x6b78b0,
      intensity: 0,
      trailColor: 0x202744,
    },
  ],
  trailStyle: { length: 0.08, width: 0.82, sparkle: 0.12 },
  burnDuration: 2.25,
  gravityScale: 0.78,
  drag: 0.62,
  windResponse: 0.42,
  soundProfile: { volume: 0.72, lowEnd: 0.74, crackle: 0.18 },
  smokeProfile: { amount: 0.48, lifetime: 7 },
};

export const FIREWORK_PRESETS: FireworkDesign[] = [
  CHRYSANTHEMUM_PRESET,
  PEONY_PRESET,
];
