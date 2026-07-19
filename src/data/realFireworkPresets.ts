import type {
  AscentEffect,
  BurstShape,
  ChildBurst,
  ColorStage,
  CoreLayer,
  FireworkDesignV1,
  FireworkDesignV2,
  FireworkFamily,
  FireworkPattern,
  PatternPoint,
  VirtualStarPreset,
} from "./firework";
import { migrateV1ToV2 } from "./migrations/v1ToV2";

interface ResearchedPresetSpec {
  ascentEffect?: AscentEffect;
  burnDuration: number;
  burstShape: BurstShape;
  burstVelocity: number;
  childBursts?: ChildBurst[];
  colors: number[];
  coreLayers?: CoreLayer[];
  description: string;
  drag: number;
  family: FireworkFamily;
  gravityScale: number;
  id: string;
  name: string;
  particleDensity: number;
  pattern: FireworkPattern;
  sparkle?: number;
  symmetry?: number;
  trailLength: number;
  trailWidth?: number;
  windResponse: number;
  crackle?: number;
  lowEnd?: number;
  smokeAmount?: number;
  volume?: number;
}

function colorStages(colors: readonly number[]): ColorStage[] {
  return colors.map((color, index) => ({
    color,
    intensity:
      index === colors.length - 1 ? 0 : Math.max(1.3 - index * 0.2, 0.7),
    normalizedTime: colors.length === 1 ? 0 : index / (colors.length - 1),
    trailColor: color,
  }));
}

function researchedPreset(spec: ResearchedPresetSpec): FireworkDesignV2 {
  const preset = migrateV1ToV2({
    ascentEffect: spec.ascentEffect ?? "gold",
    burnDuration: spec.burnDuration,
    burstShape: spec.burstShape,
    burstVelocity: spec.burstVelocity,
    childBursts: spec.childBursts ?? [],
    colorStages: colorStages(spec.colors),
    coreLayers: spec.coreLayers ?? [],
    drag: spec.drag,
    family: spec.family,
    gravityScale: spec.gravityScale,
    id: spec.id,
    name: spec.name,
    particleDensity: spec.particleDensity,
    pattern: spec.pattern,
    sizeClass: "medium",
    smokeProfile: {
      amount: spec.smokeAmount ?? 0.58,
      lifetime: 8,
    },
    soundProfile: {
      crackle: spec.crackle ?? 0.4,
      lowEnd: spec.lowEnd ?? 0.68,
      volume: spec.volume ?? 0.76,
    },
    symmetry: spec.symmetry ?? 0.9,
    trailStyle: {
      length: spec.trailLength,
      sparkle: spec.sparkle ?? 0.24,
      width: spec.trailWidth ?? 1,
    },
    windResponse: spec.windResponse,
  } satisfies FireworkDesignV1);
  preset.description = spec.description;
  return preset;
}

function outerStar(preset: FireworkDesignV2): VirtualStarPreset {
  return preset.starDefinitions[`${preset.id}-outer-star`];
}

function addStar(
  preset: FireworkDesignV2,
  id: string,
  displayName: string,
  colors: readonly number[],
  overrides: Partial<VirtualStarPreset> = {},
): string {
  preset.starDefinitions[id] = {
    ...structuredClone(outerStar(preset)),
    ...overrides,
    colorStages: colorStages(colors),
    displayName,
    id,
  };
  return id;
}

function ellipsePoints(count: number): PatternPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      groupId: "ring",
      x: Math.cos(angle),
      y: Math.sin(angle) * 0.27,
    };
  });
}

function butterflyPoints(): PatternPoint[] {
  const wings = Array.from({ length: 112 }, (_, index) => {
    const angle = (index / 112) * Math.PI * 2;
    const upperWing = Math.sin(angle) >= 0 ? 0.66 : 0.46;
    const radius = 0.28 + Math.abs(Math.sin(angle * 2)) * upperWing;
    const x = Math.cos(angle) * radius;
    return {
      groupId: x < 0 ? "left-wing" : "right-wing",
      x,
      y: Math.sin(angle) * radius,
    };
  });
  const body = Array.from({ length: 18 }, (_, index) => ({
    groupId: "body",
    x: 0,
    y: 0.48 - (index / 17) * 0.98,
  }));
  return [...wings, ...body];
}

export const WILLOW_PRESET = researchedPreset({
  burnDuration: 5.6,
  burstShape: "sphere",
  burstVelocity: 27,
  colors: [0xfff6cd, 0xffba47, 0x69e2ad, 0xef5a68, 0x59352b],
  description: "柳の枝のような色星が、色を変えながら長く垂れ落ちるポカ物。",
  drag: 0.27,
  family: "pokamono",
  gravityScale: 1.92,
  id: "preset-willow",
  name: "彩色柳",
  particleDensity: 132,
  pattern: "willow",
  sparkle: 0.22,
  symmetry: 0.84,
  trailLength: 1,
  trailWidth: 1.18,
  windResponse: 0.92,
});
{
  const layer = WILLOW_PRESET.layers.find(
    (candidate) => candidate.kind === "spherical",
  );
  if (layer?.kind === "spherical") {
    layer.name = "垂れ落ちる柳星";
    layer.jitter = 0.12;
    layer.radialSpeedScale = 0.82;
  }
  const star = outerStar(WILLOW_PRESET);
  star.emissionKind = "goldTail";
  star.gravityScale = 1.92;
  star.trailLifetime = 1;
}

export const BEE_PRESET = researchedPreset({
  burnDuration: 1.55,
  burstShape: "palm",
  burstVelocity: 33,
  colors: [0xffffff, 0xffca3d, 0xf07820, 0x482716],
  crackle: 0.72,
  description: "金色の星が蜂の群れのように短く不規則な軌跡を描くポカ物。",
  drag: 0.7,
  family: "pokamono",
  gravityScale: 0.48,
  id: "preset-bee",
  name: "金蜂",
  particleDensity: 84,
  pattern: "bee",
  sparkle: 0.72,
  symmetry: 0.62,
  trailLength: 0.7,
  trailWidth: 1.12,
  windResponse: 0.74,
});
{
  const layer = BEE_PRESET.layers.find(
    (candidate) => candidate.kind === "branch",
  );
  if (layer?.kind === "branch") {
    layer.name = "旋回する蜂星";
    layer.branchCount = 21;
    layer.starsPerBranch = 4;
    layer.thickness = 1.18;
    layer.upwardBias = 0.08;
  }
  BEE_PRESET.launchVariation.placement = 0.18;
  BEE_PRESET.launchVariation.velocity = 0.2;
  outerStar(BEE_PRESET).emissionKind = "goldTail";
}

export const HIYUSEI_PRESET = researchedPreset({
  ascentEffect: "silver",
  burnDuration: 2.35,
  burstShape: "palm",
  burstVelocity: 31,
  colors: [0xffffff, 0xff3e52, 0xffa352, 0x4a261f],
  description: "紅と緑の光跡が時間差で現れ、夜空を不規則に飛び回るポカ物。",
  drag: 0.58,
  family: "pokamono",
  gravityScale: 0.64,
  id: "preset-hiyusei",
  name: "紅緑飛遊星",
  particleDensity: 72,
  pattern: "hiyusei",
  sparkle: 0.38,
  symmetry: 0.58,
  trailLength: 0.78,
  windResponse: 0.82,
});
{
  const first = HIYUSEI_PRESET.layers.find(
    (candidate) => candidate.kind === "branch",
  );
  if (first?.kind === "branch") {
    first.name = "紅の飛遊星";
    first.branchCount = 9;
    first.starsPerBranch = 6;
    first.upwardBias = 0.18;
    const greenStar = addStar(
      HIYUSEI_PRESET,
      "preset-hiyusei-green-star",
      "緑の飛遊星",
      [0xffffff, 0x55f09a, 0x2aa6d8, 0x183f3a],
      { emissionKind: "silverTail" },
    );
    HIYUSEI_PRESET.layers.push({
      ...structuredClone(first),
      defaultStarId: greenStar,
      id: "layer-branches-green",
      ignitionOffset: 0.16,
      name: "緑の飛遊星",
      radialSpeedScale: 0.84,
    });
  }
  HIYUSEI_PRESET.launchVariation.placement = 0.16;
  HIYUSEI_PRESET.launchVariation.velocity = 0.17;
}

export const HANARAI_PRESET = researchedPreset({
  ascentEffect: "silver",
  burnDuration: 0.82,
  burstShape: "children",
  burstVelocity: 25,
  childBursts: [{ count: 8, delay: 0.2, radius: 12 }],
  colors: [0xffffff, 0xdff6ff, 0xffd56a, 0x5f4a2c],
  crackle: 0.98,
  description: "強い白銀光と火の粉が、雷のような破裂音を伴って連続するポカ物。",
  drag: 0.82,
  family: "pokamono",
  gravityScale: 0.72,
  id: "preset-hanarai",
  lowEnd: 0.92,
  name: "白銀花雷",
  particleDensity: 52,
  pattern: "hanarai",
  sparkle: 1,
  symmetry: 0.7,
  trailLength: 0.16,
  trailWidth: 1.34,
  volume: 0.94,
  windResponse: 0.44,
});
{
  const thunderStar = addStar(
    HANARAI_PRESET,
    "preset-hanarai-thunder-star",
    "白銀の花雷星",
    [0xffffff, 0xe8f7ff, 0xffca50, 0x56462e],
    {
      burnDuration: 0.72,
      emissionKind: "flicker",
      flicker: 1,
      soundTag: "crackle",
      trailLifetime: 0.12,
    },
  );
  for (const layer of HANARAI_PRESET.layers) {
    layer.defaultStarId = thunderStar;
    if (layer.kind === "child") {
      layer.name = "時間差の花雷";
      layer.scale = 0.18;
      layer.waveDelay = 0.055;
    }
  }
}

export const KALEIDOSCOPE_PRESET = researchedPreset({
  burnDuration: 1.5,
  burstShape: "children",
  burstVelocity: 22,
  childBursts: [
    { count: 6, delay: 0.13, radius: 16 },
    { count: 6, delay: 0.17, radius: 18 },
    { count: 6, delay: 0.21, radius: 20 },
  ],
  colors: [0xffffff, 0xff4d91, 0x823ae0, 0x352044],
  description:
    "色ごとにまとまった小花が一斉に開き、万華鏡のような模様を作る割物。",
  drag: 0.72,
  family: "warimono",
  gravityScale: 0.62,
  id: "preset-kaleidoscope",
  name: "彩色万華鏡",
  particleDensity: 66,
  pattern: "kaleidoscope",
  sparkle: 0.34,
  symmetry: 0.95,
  trailLength: 0.16,
  windResponse: 0.34,
});
{
  const childColors = [
    [0xffffff, 0xff3d68, 0xff8fc8, 0x57203a],
    [0xffffff, 0x54a2ff, 0x7658e8, 0x252758],
    [0xffffff, 0xffd94e, 0x64e6a4, 0x334e36],
  ] as const;
  const childLayers = KALEIDOSCOPE_PRESET.layers.filter(
    (candidate) => candidate.kind === "child",
  );
  childLayers.forEach((layer, index) => {
    const starId = addStar(
      KALEIDOSCOPE_PRESET,
      `preset-kaleidoscope-child-${index + 1}-star`,
      `万華鏡の小花 ${index + 1}`,
      childColors[index] ?? childColors[0],
      {
        burnDuration: 1.35,
        emissionKind: "child",
        flicker: 0.3,
        trailLifetime: 0.14,
      },
    );
    layer.defaultStarId = starId;
    layer.name = `色まとまり ${index + 1}`;
    layer.scale = 0.24;
    layer.waveDelay = 0.012;
  });
}

export const SATURN_PRESET = researchedPreset({
  ascentEffect: "silver",
  burnDuration: 2.6,
  burstShape: "heart",
  burstVelocity: 34,
  colors: [0xffffff, 0xffd45f, 0xff9c38, 0x57351f],
  coreLayers: [{ color: 0x4b8fff, radius: 0.52 }],
  description: "青い球形の本体を金の環が囲み、土星の姿を描く型物。",
  drag: 0.62,
  family: "warimono",
  gravityScale: 0.52,
  id: "preset-saturn",
  name: "青環土星",
  particleDensity: 104,
  pattern: "saturn",
  sparkle: 0.16,
  symmetry: 0.98,
  trailLength: 0.12,
  windResponse: 0.3,
});
{
  const ring = SATURN_PRESET.layers.find(
    (candidate) => candidate.kind === "pattern",
  );
  if (ring?.kind === "pattern") {
    ring.groups = [
      { id: "ring", name: "土星の環", starId: ring.defaultStarId },
    ];
    ring.name = "金色の環";
    ring.points = ellipsePoints(104);
    ring.rotationJitter = 5;
    ring.template = "custom";
  }
  const planet = SATURN_PRESET.layers.find(
    (candidate) => candidate.kind === "spherical",
  );
  if (planet?.kind === "spherical") {
    planet.name = "青い惑星";
    planet.count = 92;
    planet.radialSpeedScale = 0.48;
    planet.radius = 0.48;
  }
}

export const BUTTERFLY_PRESET = researchedPreset({
  ascentEffect: "silver",
  burnDuration: 2.35,
  burstShape: "heart",
  burstVelocity: 36,
  colors: [0xffffff, 0xff5d9e, 0x8648e6, 0x45234f],
  description: "左右の色分けした星が蝶の羽と胴を描く型物。",
  drag: 0.66,
  family: "warimono",
  gravityScale: 0.46,
  id: "preset-butterfly",
  name: "彩蝶",
  particleDensity: 130,
  pattern: "butterfly",
  sparkle: 0.22,
  symmetry: 0.97,
  trailLength: 0.1,
  windResponse: 0.3,
});
{
  const butterfly = BUTTERFLY_PRESET.layers.find(
    (candidate) => candidate.kind === "pattern",
  );
  if (butterfly?.kind === "pattern") {
    const blueStar = addStar(
      BUTTERFLY_PRESET,
      "preset-butterfly-blue-star",
      "蝶の青い羽星",
      [0xffffff, 0x4aa6ff, 0x7259e8, 0x272a5b],
    );
    const bodyStar = addStar(
      BUTTERFLY_PRESET,
      "preset-butterfly-body-star",
      "蝶の胴の金星",
      [0xffffff, 0xffd45a, 0xc9812f, 0x4d3521],
    );
    butterfly.groups = [
      { id: "left-wing", name: "左の羽", starId: butterfly.defaultStarId },
      { id: "right-wing", name: "右の羽", starId: blueStar },
      { id: "body", name: "胴", starId: bodyStar },
    ];
    butterfly.name = "蝶の輪郭";
    butterfly.points = butterflyPoints();
    butterfly.rotationJitter = 7;
    butterfly.template = "custom";
  }
}

export const KOWARI_PRESET = researchedPreset({
  burnDuration: 1.8,
  burstShape: "children",
  burstVelocity: 21,
  childBursts: [{ count: 7, delay: 0.34, radius: 24 }],
  colors: [0xffffff, 0xff6b54, 0x4d8dff, 0x283259],
  coreLayers: [{ color: 0xffd856, radius: 0.32 }],
  description: "中心の芯を囲む少数の小玉が、時間差で大きめの子花を開く半割物。",
  drag: 0.67,
  family: "hanwarimono",
  gravityScale: 0.68,
  id: "preset-kowari",
  name: "芯入小割",
  particleDensity: 46,
  pattern: "kowari",
  sparkle: 0.3,
  symmetry: 0.9,
  trailLength: 0.22,
  windResponse: 0.42,
});
{
  const child = KOWARI_PRESET.layers.find(
    (candidate) => candidate.kind === "child",
  );
  if (child?.kind === "child") {
    child.name = "七つの小割玉";
    child.scale = 0.46;
    child.waveDelay = 0.04;
  }
}
