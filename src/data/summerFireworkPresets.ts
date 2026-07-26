import type {
  ChildBurstLayer,
  FireworkDesignV2,
  SphericalStarLayer,
} from "./firework";

export interface SummerFireworkPresetBases {
  crown: FireworkDesignV2;
  lightRipple: FireworkDesignV2;
  senrin: FireworkDesignV2;
  willow: FireworkDesignV2;
}

export interface SummerFireworkPresetCollection {
  blueRipple: FireworkDesignV2;
  fireflySenrin: FireworkDesignV2;
  morningGlory: FireworkDesignV2;
  summerShowerWillow: FireworkDesignV2;
}

function requireSphericalLayer(
  design: FireworkDesignV2,
  id: string,
): SphericalStarLayer {
  const layer = design.layers.find(
    (candidate): candidate is SphericalStarLayer =>
      candidate.kind === "spherical" && candidate.id === id,
  );
  if (!layer) {
    throw new Error(`Spherical layer is required: ${design.id}/${id}`);
  }
  return layer;
}

function requireChildLayer(
  design: FireworkDesignV2,
  id: string,
): ChildBurstLayer {
  const layer = design.layers.find(
    (candidate): candidate is ChildBurstLayer =>
      candidate.kind === "child" && candidate.id === id,
  );
  if (!layer) {
    throw new Error(`Child layer is required: ${design.id}/${id}`);
  }
  return layer;
}

function buildMorningGlory(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  design.id = "preset-morning-glory";
  design.name = "藍紅朝顔";
  design.description =
    "藍と紅の変化星が丸い花弁を描き、淡い内花の中心で白銀の輝きが締まる夏の朝顔。";
  design.pattern = "peony";
  design.ascentEffect = "silver";
  design.burstVelocity = 35;
  design.burstField.baseVelocity = 35;
  design.themeColors = [0x456dff, 0xff405c, 0xffffff];

  const outer = requireSphericalLayer(design, "layer-outer");
  outer.coloring = {
    alternateStarId: "star-change-blue",
    mode: "longitude",
  };
  outer.count = 168;
  outer.defaultStarId = "star-repeat-change";
  outer.effectTiming = {
    cycles: 2,
    direction: "forward",
    mapping: "longitude",
    offset: 0,
    spread: 0.34,
  };
  outer.jitter = 0.025;
  outer.name = "藍紅の朝顔花弁";

  const innerFlower = requireSphericalLayer(design, "layer-core-2");
  innerFlower.coloring = { mode: "layer" };
  innerFlower.count = 82;
  innerFlower.defaultStarId = "star-gradient-fade";
  innerFlower.effectTiming = {
    cycles: 1,
    direction: "reverse",
    mapping: "latitude",
    offset: 0.08,
    spread: 0.3,
  };
  innerFlower.name = "淡く流れる内花";
  innerFlower.radialSpeedScale = 0.56;
  innerFlower.radius = 0.56;

  const center = requireSphericalLayer(design, "layer-core-1");
  center.coloring = { mode: "layer" };
  center.count = 34;
  center.defaultStarId = "star-teka";
  center.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "random",
    offset: 0,
    spread: 0.12,
  };
  center.name = "朝顔の白銀芯";
  center.radialSpeedScale = 0.22;
  center.radius = 0.22;

  return design;
}

function buildFireflySenrin(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  design.id = "preset-firefly-senrin";
  design.name = "宵蛍千輪";
  design.description =
    "金の親星が静かにほどけ、時間差で開く小さな彩色点滅星が夏の宵の蛍を思わせる千輪。";
  design.ascentEffect = "gold";
  design.themeColors = [0xffd763, 0xeef8b0, 0x8feaff];

  const carrier = requireSphericalLayer(design, "layer-outer");
  carrier.coloring = { mode: "layer" };
  carrier.count = 42;
  carrier.defaultStarId = "star-gold";
  carrier.jitter = 0.08;
  carrier.name = "蛍を運ぶ金の親星";
  carrier.radialSpeedScale = 0.34;
  carrier.radius = 0.34;

  const fireflies = requireChildLayer(design, "layer-child-1");
  fireflies.count = 14;
  fireflies.defaultStarId = "star-strobe-pastel";
  fireflies.delay = 0.48;
  fireflies.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "random",
    offset: 0,
    spread: 1,
  };
  fireflies.name = "宵空を漂う蛍";
  fireflies.radialSpeedScale = 0.92;
  fireflies.scale = 0.21;
  fireflies.waveDelay = 0.055;

  const glow = structuredClone(carrier);
  glow.count = 28;
  glow.defaultStarId = "star-kouro";
  glow.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "random",
    offset: 0,
    spread: 0.6,
  };
  glow.id = "layer-firefly-glow";
  glow.ignitionOffset = 0.12;
  glow.jitter = 0.12;
  glow.name = "蛍籠の淡い光";
  glow.radialSpeedScale = 0.18;
  glow.radius = 0.18;
  design.layers.push(glow);

  return design;
}

function buildBlueRipple(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  design.id = "preset-blue-ripple";
  design.name = "涼風青波";
  design.description =
    "青銀の星を混ぜた同心の光が中心から外へ順に巡り、涼風に揺れる夏の水面を描く作品。";
  design.pattern = "chrysanthemum";
  design.ascentEffect = "silver";
  design.themeColors = [0x8feaff, 0xbfe4ff, 0xffffff];

  const ripple = requireSphericalLayer(design, "layer-outer");
  ripple.coloring = {
    alternateStarId: "star-kouro",
    mode: "alternating",
  };
  ripple.defaultStarId = "star-relay-light";
  ripple.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "radius",
    offset: 0,
    spread: 0.92,
  };
  ripple.name = "水面を渡る青銀の波";
  ripple.overrides = ripple.overrides.map((override, index) => ({
    ...override,
    starId: index % 2 === 0 ? "star-relay-light" : "star-kouro",
  }));

  return design;
}

function buildSummerShowerWillow(base: FireworkDesignV2): FireworkDesignV2 {
  const design = structuredClone(base);
  design.id = "preset-summer-shower-willow";
  design.name = "夕立錦柳";
  design.description =
    "長く垂れる金の柳へ銀の雨筋が重なり、遅れて細かな飛沫がはじける夏の夕立の大玉。";
  design.ascentEffect = "gold";
  design.sizeClass = "large";
  design.themeColors = [0xffd36a, 0xd8efff, 0xffffff];

  const willow = requireSphericalLayer(design, "layer-outer");
  willow.coloring = { mode: "layer" };
  willow.count = 112;
  willow.defaultStarId = "star-long";
  willow.jitter = 0.14;
  willow.name = "長く垂れる錦柳";
  willow.radialSpeedScale = 0.84;
  willow.radius = 1;

  const silverRain = structuredClone(willow);
  silverRain.count = 76;
  silverRain.defaultStarId = "star-silver";
  delete silverRain.effectTiming;
  silverRain.id = "layer-silver-rain";
  silverRain.ignitionOffset = 0.16;
  silverRain.jitter = 0.2;
  silverRain.name = "夕立の銀雨";
  silverRain.radialSpeedScale = 0.68;
  silverRain.radius = 0.72;

  const splashes = structuredClone(willow);
  splashes.count = 44;
  splashes.defaultStarId = "star-popping";
  splashes.effectTiming = {
    cycles: 1,
    direction: "forward",
    mapping: "random",
    offset: 0,
    spread: 0.72,
  };
  splashes.id = "layer-rain-splashes";
  splashes.ignitionOffset = 0.32;
  splashes.jitter = 0.22;
  splashes.name = "遅れてはじける雨飛沫";
  splashes.radialSpeedScale = 0.5;
  splashes.radius = 0.54;

  design.layers.push(silverRain, splashes);
  return design;
}

export function buildSummerFireworkPresets(
  bases: SummerFireworkPresetBases,
): SummerFireworkPresetCollection {
  return {
    blueRipple: buildBlueRipple(bases.lightRipple),
    fireflySenrin: buildFireflySenrin(bases.senrin),
    morningGlory: buildMorningGlory(bases.crown),
    summerShowerWillow: buildSummerShowerWillow(bases.willow),
  };
}
