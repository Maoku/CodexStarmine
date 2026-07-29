import type {
  ColorStage,
  FireworkDesignV2,
  SphericalStarLayer,
  StarPointOverride,
  VirtualStarPreset,
} from "./firework";

export interface SummerFireworkPresetBases {
  chrysanthemum: FireworkDesignV2;
  lightRipple: FireworkDesignV2;
  willow: FireworkDesignV2;
}

export interface SummerFireworkPresetCollection {
  blueTipWillow: FireworkDesignV2;
  coolWaterRipple: FireworkDesignV2;
  summerSunflower: FireworkDesignV2;
  watermelonRing: FireworkDesignV2;
}

type ColorStop = readonly [
  normalizedTime: number,
  color: number,
  intensity: number,
  trailColor: number,
];

interface SphericalLayerSpec {
  count: number;
  defaultStarId: string;
  id: string;
  ignitionOffset?: number;
  jitter?: number;
  missingRate?: number;
  name: string;
  radialSpeedScale: number;
  radius: number;
  seedOffset: number;
}

function colorStages(stops: readonly ColorStop[]): ColorStage[] {
  return stops.map(([normalizedTime, color, intensity, trailColor]) => ({
    color,
    intensity,
    normalizedTime,
    trailColor,
  }));
}

function defineStar(
  design: FireworkDesignV2,
  templateId: string,
  id: string,
  displayName: string,
  stops: readonly ColorStop[],
  overrides: Partial<
    Omit<VirtualStarPreset, "colorStages" | "displayName" | "id">
  > = {},
): string {
  const template = design.starDefinitions[templateId];
  if (!template) {
    throw new Error(`Virtual star is required: ${design.id}/${templateId}`);
  }
  design.starDefinitions[id] = {
    ...structuredClone(template),
    ...overrides,
    colorStages: colorStages(stops),
    displayName,
    id,
  };
  return id;
}

function sphericalLayer(
  design: FireworkDesignV2,
  spec: SphericalLayerSpec,
): SphericalStarLayer {
  return {
    coloring: { mode: "layer" },
    count: spec.count,
    defaultStarId: spec.defaultStarId,
    id: spec.id,
    ignitionOffset: spec.ignitionOffset ?? 0,
    jitter: spec.jitter ?? 0.015,
    kind: "spherical",
    locked: false,
    missingRate: spec.missingRate ?? 0,
    name: spec.name,
    overrides: [],
    placement: "fibonacci",
    placementSeed: design.assemblySeed + spec.seedOffset,
    radialSpeedScale: spec.radialSpeedScale,
    radius: spec.radius,
    visible: true,
  };
}

function fibonacciSphereOverrides(
  count: number,
  removeEvery: number,
): StarPointOverride[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - ((index + 0.5) / count) * 2;
    const horizontal = Math.sqrt(Math.max(1 - y * y, 0));
    const angle = index * goldenAngle;
    return {
      index,
      position: {
        x: Math.cos(angle) * horizontal,
        y,
        z: Math.sin(angle) * horizontal,
      },
      ...(index % removeEvery === 0 ? { removed: true } : undefined),
    };
  });
}

function configureSingleBurst(
  design: FireworkDesignV2,
  input: {
    ascentEffect: FireworkDesignV2["ascentEffect"];
    baseVelocity: number;
    description: string;
    gravityScale: number;
    id: string;
    name: string;
    pattern: FireworkDesignV2["pattern"];
    seed: number;
    sizeClass?: FireworkDesignV2["sizeClass"];
    themeColors: number[];
  },
): void {
  design.ascentEffect = input.ascentEffect;
  design.assemblySeed = input.seed;
  design.burstField.baseVelocity = input.baseVelocity;
  design.burstField.gravityScale = input.gravityScale;
  design.burstVelocity = input.baseVelocity;
  design.description = input.description;
  design.id = input.id;
  design.name = input.name;
  design.pattern = input.pattern;
  design.sizeClass = input.sizeClass ?? "medium";
  design.themeColors = input.themeColors;
  design.launchVariation = {
    ignition: 0.018,
    lifetime: 0.025,
    placement: 0.008,
    velocity: 0.018,
  };
  design.realism = {
    ignitionJitter: 0.012,
    lifetimeJitter: 0.025,
    missingRate: 0,
    placementJitter: 0.008,
    velocityJitter: 0.018,
  };
}

function syncCompatibilityFields(
  design: FireworkDesignV2,
  primaryStarId: string,
): void {
  const primary = design.starDefinitions[primaryStarId];
  design.burnDuration = primary.burnDuration;
  design.colorStages = structuredClone(primary.colorStages);
  design.drag = primary.drag;
  design.gravityScale = primary.gravityScale;
  design.particleDensity = design.layers.reduce((sum, layer) => {
    if (layer.kind === "spherical") return sum + layer.count;
    if (layer.kind === "branch") {
      return sum + layer.branchCount * layer.starsPerBranch;
    }
    if (layer.kind === "pattern") return sum + layer.points.length;
    return sum + layer.count * 24;
  }, 0);
  design.trailStyle = {
    length: primary.trailLifetime,
    sparkle: primary.flicker,
    width: primary.trailWidth,
  };
}

function buildSummerSunflower(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  configureSingleBurst(design, {
    ascentEffect: "gold",
    baseVelocity: 34,
    description:
      "参照画像の左上を逆算し、密な金色の放射花弁と琥珀色の芯を一発で開く夏の向日葵。",
    gravityScale: 0.86,
    id: "preset-summer-sunflower",
    name: "盛夏の向日葵",
    pattern: "chrysanthemum",
    seed: 0x5346_0101,
    themeColors: [0xffd65c, 0xffa11f, 0xfff1b0],
  });

  const goldPetal = defineStar(
    design,
    "star-gold",
    "star-summer-sunflower-gold",
    "向日葵の金色花弁星",
    [
      [0, 0xfff8c4, 1.42, 0xffc247],
      [0.1, 0xffd65c, 1.24, 0xffa11f],
      [0.7, 0xffa11f, 0.86, 0xd86e12],
      [1, 0x6b3510, 0, 0x4a250d],
    ],
    {
      brightness: 1.28,
      burnDuration: 3.7,
      drag: 0.5,
      effectProfile: {
        light: { mode: "continuous" },
        trail: { grainSpacing: 1, mode: "granular" },
      },
      emissionKind: "goldTail",
      flicker: 0.24,
      gravityScale: 0.86,
      smokeAmount: 0.48,
      trailLifetime: 0.78,
      trailWidth: 0.94,
    },
  );
  const amberCore = defineStar(
    design,
    "star-teka",
    "star-summer-sunflower-core",
    "向日葵の琥珀芯星",
    [
      [0, 0xffffff, 1.5, 0xffe08a],
      [0.12, 0xffc238, 1.3, 0xffa11f],
      [0.76, 0xff8a16, 0.72, 0xc65c0c],
      [1, 0x51260c, 0, 0x351807],
    ],
    {
      brightness: 1.38,
      burnDuration: 2.55,
      drag: 0.64,
      effectProfile: { light: { mode: "continuous" } },
      emissionKind: "goldTail",
      flicker: 0.1,
      gravityScale: 0.56,
      trailLifetime: 0.38,
      trailWidth: 1.06,
    },
  );

  design.layers = [
    sphericalLayer(design, {
      count: 224,
      defaultStarId: goldPetal,
      id: "layer-sunflower-outer-petals",
      jitter: 0.02,
      name: "密に開く外花弁",
      radialSpeedScale: 1,
      radius: 1,
      seedOffset: 11,
    }),
    sphericalLayer(design, {
      count: 116,
      defaultStarId: goldPetal,
      id: "layer-sunflower-inner-petals",
      ignitionOffset: 0.025,
      jitter: 0.012,
      name: "重なる内花弁",
      radialSpeedScale: 0.7,
      radius: 0.7,
      seedOffset: 31,
    }),
    sphericalLayer(design, {
      count: 32,
      defaultStarId: amberCore,
      id: "layer-sunflower-amber-core",
      ignitionOffset: 0.045,
      jitter: 0.006,
      name: "琥珀色の花芯",
      radialSpeedScale: 0.16,
      radius: 0.16,
      seedOffset: 53,
    }),
  ];
  syncCompatibilityFields(design, goldPetal);
  return design;
}

function buildCoolWaterRipple(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  configureSingleBurst(design, {
    ascentEffect: "silver",
    baseVelocity: 36,
    description:
      "参照画像の右上を逆算し、群青の放射線、鮮やかな水色の輪、白銀の先端を同心状に開く涼風の水輪。",
    gravityScale: 0.5,
    id: "preset-cool-water-ripple",
    name: "涼風の水輪",
    pattern: "chrysanthemum",
    seed: 0x5346_0202,
    themeColors: [0x35e7ff, 0x255bff, 0xf4fbff],
  });

  const cobaltTip = defineStar(
    design,
    "star-change-blue",
    "star-water-ripple-cobalt-tip",
    "群青から白銀へ変わる水輪星",
    [
      [0, 0xf8fdff, 1.38, 0x4a8bff],
      [0.1, 0x3976ff, 1.2, 0x255bff],
      [0.68, 0x1738c5, 0.82, 0x1738c5],
      [0.88, 0xf5fcff, 1.18, 0xbcefff],
      [1, 0x8aa7c7, 0, 0x58708e],
    ],
    {
      brightness: 1.3,
      burnDuration: 3.2,
      drag: 0.6,
      effectProfile: { light: { mode: "continuous" } },
      emissionKind: "silverTail",
      flicker: 0.12,
      gravityScale: 0.5,
      trailLifetime: 0.52,
      trailWidth: 0.9,
    },
  );
  const cyanRing = defineStar(
    design,
    "star-kouro",
    "star-water-ripple-cyan",
    "鮮やかな水色の輪星",
    [
      [0, 0xffffff, 1.46, 0x9ff7ff],
      [0.1, 0x42efff, 1.3, 0x35e7ff],
      [0.74, 0x16aecd, 0.82, 0x168aaa],
      [1, 0x315d70, 0, 0x274956],
    ],
    {
      brightness: 1.34,
      burnDuration: 2.9,
      drag: 0.66,
      effectProfile: {
        light: {
          mode: "continuous",
          terminal: {
            duration: 0.12,
            mode: "kouro",
            sparkleCount: 2,
            strength: 1.15,
          },
        },
      },
      emissionKind: "silverTail",
      flicker: 0.06,
      gravityScale: 0.46,
      trailLifetime: 0.34,
      trailWidth: 1.02,
    },
  );
  const deepBlue = defineStar(
    design,
    "star-change-blue",
    "star-water-ripple-deep-blue",
    "水輪の深い青芯星",
    [
      [0, 0xbdeaff, 1.24, 0x477bff],
      [0.12, 0x2854ef, 1.08, 0x2447cf],
      [0.8, 0x10287f, 0.62, 0x10216b],
      [1, 0x091438, 0, 0x091438],
    ],
    {
      brightness: 1.18,
      burnDuration: 2.75,
      drag: 0.7,
      effectProfile: { light: { mode: "continuous" } },
      emissionKind: "silverTail",
      flicker: 0.04,
      gravityScale: 0.4,
      trailLifetime: 0.24,
      trailWidth: 0.82,
    },
  );

  design.layers = [
    sphericalLayer(design, {
      count: 156,
      defaultStarId: cobaltTip,
      id: "layer-water-ripple-outer",
      jitter: 0.008,
      name: "白銀へ変わる群青の外輪",
      radialSpeedScale: 1,
      radius: 1,
      seedOffset: 17,
    }),
    sphericalLayer(design, {
      count: 176,
      defaultStarId: cyanRing,
      id: "layer-water-ripple-cyan",
      ignitionOffset: 0.035,
      jitter: 0.004,
      name: "鮮やかな水色の中輪",
      radialSpeedScale: 0.64,
      radius: 0.64,
      seedOffset: 37,
    }),
    sphericalLayer(design, {
      count: 104,
      defaultStarId: deepBlue,
      id: "layer-water-ripple-core",
      ignitionOffset: 0.055,
      jitter: 0.006,
      name: "群青の放射芯",
      radialSpeedScale: 0.43,
      radius: 0.43,
      seedOffset: 59,
    }),
  ];
  syncCompatibilityFields(design, cobaltTip);
  return design;
}

function buildBlueTipWillow(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  configureSingleBurst(design, {
    ascentEffect: "gold",
    baseVelocity: 28,
    description:
      "参照画像の左下を逆算し、長く垂れる金の柳の先だけを涼しい青へ変化させる大玉。",
    gravityScale: 1.92,
    id: "preset-blue-tip-willow",
    name: "宵涼みの青先柳",
    pattern: "willow",
    seed: 0x5346_0303,
    sizeClass: "large",
    themeColors: [0xffd36a, 0xe89b28, 0x4b9dff],
  });

  const goldToBlue = defineStar(
    design,
    "star-long",
    "star-blue-tip-willow",
    "金から青へ変わる長寿命柳星",
    [
      [0, 0xfff5c2, 1.38, 0xffd36a],
      [0.08, 0xffd36a, 1.22, 0xe89b28],
      [0.72, 0xd88924, 0.86, 0xb96e1e],
      [0.84, 0x4b9dff, 1.18, 0xb96e1e],
      [0.95, 0xbfe6ff, 0.78, 0x4b9dff],
      [1, 0x24456f, 0, 0x24395b],
    ],
    {
      brightness: 1.3,
      burnDuration: 5.35,
      drag: 0.28,
      effectProfile: {
        light: { mode: "continuous" },
        trail: { grainSpacing: 1, mode: "granular" },
      },
      emissionKind: "goldTail",
      flicker: 0.18,
      gravityScale: 1.92,
      smokeAmount: 0.58,
      trailLifetime: 1,
      trailWidth: 1.12,
    },
  );
  const warmFill = defineStar(
    design,
    "star-gold",
    "star-blue-tip-willow-fill",
    "柳を満たす細い金星",
    [
      [0, 0xfff4bd, 1.28, 0xffca52],
      [0.1, 0xffc44a, 1.1, 0xe59929],
      [0.8, 0xae641d, 0.66, 0x7c4618],
      [1, 0x47270f, 0, 0x321b0b],
    ],
    {
      brightness: 1.16,
      burnDuration: 4.8,
      drag: 0.32,
      effectProfile: {
        light: { mode: "continuous" },
        trail: { grainSpacing: 1, mode: "granular" },
      },
      emissionKind: "goldTail",
      flicker: 0.2,
      gravityScale: 1.82,
      trailLifetime: 0.92,
      trailWidth: 0.86,
    },
  );

  design.layers = [
    sphericalLayer(design, {
      count: 164,
      defaultStarId: goldToBlue,
      id: "layer-blue-tip-willow-outer",
      jitter: 0.1,
      name: "青い先端を持つ錦柳",
      radialSpeedScale: 0.88,
      radius: 1,
      seedOffset: 23,
    }),
    sphericalLayer(design, {
      count: 64,
      defaultStarId: warmFill,
      id: "layer-blue-tip-willow-fill",
      ignitionOffset: 0.055,
      jitter: 0.08,
      name: "中心を満たす金の細柳",
      radialSpeedScale: 0.62,
      radius: 0.68,
      seedOffset: 43,
    }),
  ];
  syncCompatibilityFields(design, goldToBlue);
  return design;
}

function buildWatermelonRing(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  configureSingleBurst(design, {
    ascentEffect: "silver",
    baseVelocity: 35,
    description:
      "参照画像の右下を逆算し、緑の皮、白い境界、珊瑚色の果肉を三重の球殻で描く西瓜の一発玉。",
    gravityScale: 0.56,
    id: "preset-watermelon-ring",
    name: "納涼の西瓜輪",
    pattern: "peony",
    seed: 0x5346_0404,
    themeColors: [0x43ed69, 0xffffff, 0xff4658],
  });

  const greenRind = defineStar(
    design,
    "star-change-blue",
    "star-watermelon-green-rind",
    "西瓜の緑皮星",
    [
      [0, 0xf1fff3, 1.36, 0x8dff9d],
      [0.1, 0x43ed69, 1.22, 0x2acb4f],
      [0.78, 0x158f3a, 0.74, 0x126b30],
      [1, 0x0b3d1e, 0, 0x082d17],
    ],
    {
      brightness: 1.28,
      burnDuration: 3.15,
      drag: 0.62,
      effectProfile: { light: { mode: "continuous" } },
      emissionKind: "silverTail",
      flicker: 0.12,
      gravityScale: 0.56,
      trailLifetime: 0.46,
      trailWidth: 0.9,
    },
  );
  const whiteRind = defineStar(
    design,
    "star-silver",
    "star-watermelon-white-rind",
    "西瓜の白い境界星",
    [
      [0, 0xffffff, 1.5, 0xffffff],
      [0.12, 0xf4fff8, 1.3, 0xe6f5ec],
      [0.8, 0xbcd0c3, 0.68, 0x91aa99],
      [1, 0x52645a, 0, 0x3e4d44],
    ],
    {
      brightness: 1.36,
      burnDuration: 2.85,
      drag: 0.68,
      effectProfile: { light: { mode: "continuous" } },
      emissionKind: "silverTail",
      flicker: 0.08,
      gravityScale: 0.52,
      trailLifetime: 0.32,
      trailWidth: 0.98,
    },
  );
  const coralFlesh = defineStar(
    design,
    "star-solid-red",
    "star-watermelon-coral-flesh",
    "西瓜の珊瑚色果肉星",
    [
      [0, 0xfff3ed, 1.4, 0xff8d91],
      [0.1, 0xff4658, 1.24, 0xf33549],
      [0.76, 0xc91937, 0.8, 0xa5122e],
      [1, 0x5c0a1c, 0, 0x400713],
    ],
    {
      brightness: 1.28,
      burnDuration: 2.75,
      drag: 0.7,
      effectProfile: { light: { mode: "continuous" } },
      emissionKind: "silverTail",
      flicker: 0.06,
      gravityScale: 0.48,
      trailLifetime: 0.28,
      trailWidth: 0.86,
    },
  );

  const coralLayer = sphericalLayer(design, {
    count: 232,
    defaultStarId: coralFlesh,
    id: "layer-watermelon-coral-flesh",
    ignitionOffset: 0.045,
    jitter: 0.008,
    name: "種のような抜けを残す赤い果肉",
    radialSpeedScale: 0.63,
    radius: 0.63,
    seedOffset: 71,
  });
  coralLayer.overrides = fibonacciSphereOverrides(coralLayer.count, 15);
  coralLayer.placement = "manual";

  design.layers = [
    sphericalLayer(design, {
      count: 196,
      defaultStarId: greenRind,
      id: "layer-watermelon-green-rind",
      jitter: 0.008,
      name: "明るい緑の外皮",
      radialSpeedScale: 1,
      radius: 1,
      seedOffset: 29,
    }),
    sphericalLayer(design, {
      count: 148,
      defaultStarId: whiteRind,
      id: "layer-watermelon-white-rind",
      ignitionOffset: 0.025,
      jitter: 0.005,
      name: "薄い白の境界輪",
      radialSpeedScale: 0.74,
      radius: 0.74,
      seedOffset: 47,
    }),
    coralLayer,
  ];
  syncCompatibilityFields(design, greenRind);
  return design;
}

export function buildSummerFireworkPresets(
  bases: SummerFireworkPresetBases,
): SummerFireworkPresetCollection {
  return {
    blueTipWillow: buildBlueTipWillow(bases.willow),
    coolWaterRipple: buildCoolWaterRipple(bases.lightRipple),
    summerSunflower: buildSummerSunflower(bases.chrysanthemum),
    watermelonRing: buildWatermelonRing(bases.chrysanthemum),
  };
}
