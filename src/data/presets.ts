import type {
  FireworkDesignV1,
  FireworkDesignV2,
  SphericalStarLayer,
  StarPointOverride,
} from "./firework";
import { migrateV1ToV2 } from "./migrations/v1ToV2";
import {
  BEE_PRESET,
  BUTTERFLY_PRESET,
  HANARAI_PRESET,
  HIYUSEI_PRESET,
  KALEIDOSCOPE_PRESET,
  KOWARI_PRESET,
  SATURN_PRESET,
  WILLOW_PRESET,
} from "./realFireworkPresets";

export {
  BEE_PRESET,
  BUTTERFLY_PRESET,
  HANARAI_PRESET,
  HIYUSEI_PRESET,
  KALEIDOSCOPE_PRESET,
  KOWARI_PRESET,
  SATURN_PRESET,
  WILLOW_PRESET,
} from "./realFireworkPresets";

export const CHRYSANTHEMUM_PRESET: FireworkDesignV2 = migrateV1ToV2({
  ascentEffect: "gold",
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
} satisfies FireworkDesignV1);

export const PEONY_PRESET: FireworkDesignV2 = migrateV1ToV2({
  ascentEffect: "silver",
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
} satisfies FireworkDesignV1);

export const CROWN_PRESET: FireworkDesignV2 = migrateV1ToV2({
  ascentEffect: "gold",
  id: "preset-crown",
  name: "錦冠",
  family: "warimono",
  pattern: "crown",
  sizeClass: "medium",
  burstShape: "sphere",
  burstVelocity: 29,
  symmetry: 0.92,
  particleDensity: 170,
  coreLayers: [
    { radius: 0.42, color: 0xff5656 },
    { radius: 0.66, color: 0x6d89ff },
  ],
  childBursts: [],
  colorStages: [
    {
      normalizedTime: 0,
      color: 0xfff4c2,
      intensity: 1.28,
      trailColor: 0xffcf70,
    },
    {
      normalizedTime: 0.46,
      color: 0xffc35a,
      intensity: 0.88,
      trailColor: 0xd89538,
    },
    {
      normalizedTime: 1,
      color: 0x8c542e,
      intensity: 0,
      trailColor: 0x5f3b25,
    },
  ],
  trailStyle: { length: 1, width: 1.18, sparkle: 0.2 },
  burnDuration: 5.45,
  gravityScale: 1.82,
  drag: 0.34,
  windResponse: 0.86,
  soundProfile: { volume: 0.84, lowEnd: 0.88, crackle: 0.46 },
  smokeProfile: { amount: 0.76, lifetime: 10 },
} satisfies FireworkDesignV1);

export const PALM_PRESET: FireworkDesignV2 = migrateV1ToV2({
  ascentEffect: "silver",
  id: "preset-palm",
  name: "銀椰子",
  family: "warimono",
  pattern: "palm",
  sizeClass: "medium",
  burstShape: "palm",
  burstVelocity: 38,
  symmetry: 0.86,
  particleDensity: 74,
  coreLayers: [{ radius: 0.38, color: 0xff5252 }],
  childBursts: [],
  colorStages: [
    {
      normalizedTime: 0,
      color: 0xffffff,
      intensity: 1.45,
      trailColor: 0xe6f1ff,
    },
    {
      normalizedTime: 0.55,
      color: 0xadd9ff,
      intensity: 0.82,
      trailColor: 0xb8d6e8,
    },
    {
      normalizedTime: 1,
      color: 0x516172,
      intensity: 0,
      trailColor: 0x33414c,
    },
  ],
  trailStyle: { length: 0.94, width: 1.65, sparkle: 0.36 },
  burnDuration: 3.85,
  gravityScale: 1.18,
  drag: 0.44,
  windResponse: 0.68,
  soundProfile: { volume: 0.8, lowEnd: 0.78, crackle: 0.62 },
  smokeProfile: { amount: 0.7, lifetime: 9 },
} satisfies FireworkDesignV1);

export const SENRIN_PRESET: FireworkDesignV2 = migrateV1ToV2({
  ascentEffect: "gold",
  id: "preset-senrin",
  name: "彩色千輪",
  family: "hanwarimono",
  pattern: "senrin",
  sizeClass: "medium",
  burstShape: "children",
  burstVelocity: 18,
  symmetry: 0.84,
  particleDensity: 40,
  coreLayers: [],
  childBursts: [{ count: 12, delay: 0.58, radius: 22 }],
  colorStages: [
    {
      normalizedTime: 0,
      color: 0xfff0d0,
      intensity: 1.25,
      trailColor: 0xffbd65,
    },
    {
      normalizedTime: 0.25,
      color: 0xff4d91,
      intensity: 1,
      trailColor: 0xe86a9d,
    },
    {
      normalizedTime: 0.72,
      color: 0x55dfff,
      intensity: 0.74,
      trailColor: 0x4d9bb3,
    },
    {
      normalizedTime: 1,
      color: 0x604c8c,
      intensity: 0,
      trailColor: 0x2b283f,
    },
  ],
  trailStyle: { length: 0.26, width: 0.82, sparkle: 0.18 },
  burnDuration: 1.75,
  gravityScale: 0.72,
  drag: 0.7,
  windResponse: 0.4,
  soundProfile: { volume: 0.76, lowEnd: 0.64, crackle: 0.7 },
  smokeProfile: { amount: 0.78, lifetime: 9 },
} satisfies FireworkDesignV1);

export const HEART_PRESET: FireworkDesignV2 = migrateV1ToV2({
  ascentEffect: "silver",
  id: "preset-heart",
  name: "紅恋花",
  family: "warimono",
  pattern: "heart",
  sizeClass: "medium",
  burstShape: "heart",
  burstVelocity: 38,
  symmetry: 0.98,
  particleDensity: 150,
  coreLayers: [],
  childBursts: [],
  colorStages: [
    {
      normalizedTime: 0,
      color: 0xffffff,
      intensity: 1.35,
      trailColor: 0xff8da8,
    },
    {
      normalizedTime: 0.13,
      color: 0xff285f,
      intensity: 1.08,
      trailColor: 0xf54270,
    },
    {
      normalizedTime: 0.72,
      color: 0xff79bd,
      intensity: 0.7,
      trailColor: 0xb94e78,
    },
    {
      normalizedTime: 1,
      color: 0x633044,
      intensity: 0,
      trailColor: 0x321923,
    },
  ],
  trailStyle: { length: 0.16, width: 0.92, sparkle: 0.12 },
  burnDuration: 2.65,
  gravityScale: 0.46,
  drag: 0.62,
  windResponse: 0.35,
  soundProfile: { volume: 0.68, lowEnd: 0.58, crackle: 0.22 },
  smokeProfile: { amount: 0.46, lifetime: 7 },
} satisfies FireworkDesignV1);

function ringOverrides(count: number): StarPointOverride[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      index,
      position: {
        x: Math.cos(angle),
        y: 0,
        z: Math.sin(angle),
      },
    };
  });
}

function rippleOverrides(
  rings: number,
  pointsPerRing: number,
): StarPointOverride[] {
  const count = rings * pointsPerRing;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const shell = Math.floor(index / pointsPerRing);
    const localIndex = index % pointsPerRing;
    const radius = 0.24 + (shell / Math.max(rings - 1, 1)) * 0.76;
    const y = 1 - ((localIndex + 0.5) / pointsPerRing) * 2;
    const horizontal = Math.sqrt(Math.max(1 - y * y, 0));
    const angle = localIndex * goldenAngle + shell * 0.19;
    return {
      index,
      position: {
        x: Math.cos(angle) * horizontal * radius,
        y: y * radius,
        z: Math.sin(angle) * horizontal * radius,
      },
    };
  });
}

function outerLayer(design: FireworkDesignV2): SphericalStarLayer {
  const layer = design.layers.find(
    (candidate): candidate is SphericalStarLayer =>
      candidate.kind === "spherical",
  );
  if (!layer) throw new Error(`Spherical layer is required: ${design.id}`);
  return layer;
}

export const ILLUMINATION_PRESET: FireworkDesignV2 =
  structuredClone(PEONY_PRESET);
ILLUMINATION_PRESET.id = "preset-illumination";
ILLUMINATION_PRESET.name = "彩色イルミネーション";
ILLUMINATION_PRESET.description =
  "彩色点滅星が決定的なランダム順で明滅し、球面に光の連鎖を描く作品。";
{
  const layer = outerLayer(ILLUMINATION_PRESET);
  layer.defaultStarId = "star-strobe-pastel";
  layer.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "random",
    offset: 0,
    spread: 1,
  };
  layer.name = "彩色リレー球";
}

export const ROTATING_LIGHT_RING_PRESET: FireworkDesignV2 =
  structuredClone(CHRYSANTHEMUM_PRESET);
ROTATING_LIGHT_RING_PRESET.id = "preset-rotating-light-ring";
ROTATING_LIGHT_RING_PRESET.name = "回転光環";
ROTATING_LIGHT_RING_PRESET.description =
  "固定された環の星を経度順に点灯し、粒子を旋回させずに光だけが巡る作品。";
{
  const layer = outerLayer(ROTATING_LIGHT_RING_PRESET);
  layer.count = 96;
  layer.defaultStarId = "star-relay-light";
  layer.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "longitude",
    offset: 0,
    spread: 1,
  };
  layer.jitter = 0;
  layer.name = "経度リレー環";
  layer.overrides = ringOverrides(layer.count);
  layer.placement = "manual";
}

export const LIGHT_RIPPLE_PRESET: FireworkDesignV2 =
  structuredClone(CHRYSANTHEMUM_PRESET);
LIGHT_RIPPLE_PRESET.id = "preset-light-ripple";
LIGHT_RIPPLE_PRESET.name = "光の波紋";
LIGHT_RIPPLE_PRESET.description =
  "同心状に置いた星が中心から外へ順に灯り、球面を波紋のように伝わる作品。";
{
  const layer = outerLayer(LIGHT_RIPPLE_PRESET);
  const overrides = rippleOverrides(5, 36);
  layer.count = overrides.length;
  layer.defaultStarId = "star-relay-light";
  layer.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "radius",
    offset: 0,
    spread: 0.8,
  };
  layer.jitter = 0;
  layer.name = "同心リレー球";
  layer.overrides = overrides;
  layer.placement = "manual";
}

export const KOURO_CHANGE_CHRYSANTHEMUM_PRESET: FireworkDesignV2 =
  structuredClone(CHRYSANTHEMUM_PRESET);
KOURO_CHANGE_CHRYSANTHEMUM_PRESET.id = "preset-kouro-change-chrysanthemum";
KOURO_CHANGE_CHRYSANTHEMUM_PRESET.name = "光露変化菊";
KOURO_CHANGE_CHRYSANTHEMUM_PRESET.description =
  "変化菊の外周を銀光露星で仕立て、消え際にやわらかな余韻を残す作品。";
{
  const layer = outerLayer(KOURO_CHANGE_CHRYSANTHEMUM_PRESET);
  layer.defaultStarId = "star-kouro";
  layer.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "index",
    offset: 0,
    spread: 0.18,
  };
  layer.name = "光露の変化菊";
}

export const FIREWORK_PRESETS: FireworkDesignV2[] = [
  CHRYSANTHEMUM_PRESET,
  PEONY_PRESET,
  CROWN_PRESET,
  PALM_PRESET,
  SENRIN_PRESET,
  HEART_PRESET,
  WILLOW_PRESET,
  BEE_PRESET,
  HIYUSEI_PRESET,
  HANARAI_PRESET,
  KALEIDOSCOPE_PRESET,
  SATURN_PRESET,
  BUTTERFLY_PRESET,
  KOWARI_PRESET,
  ILLUMINATION_PRESET,
  ROTATING_LIGHT_RING_PRESET,
  LIGHT_RIPPLE_PRESET,
  KOURO_CHANGE_CHRYSANTHEMUM_PRESET,
];
