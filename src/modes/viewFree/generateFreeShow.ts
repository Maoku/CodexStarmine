import {
  resolveSizePreset,
  type FireworkDesign,
  type ShowCue,
  type ShowPlan,
  type SizeClass,
} from "../../data";

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^= value >>> 15) >>> 0) / 4_294_967_296;
  };
}

function choose(
  designs: FireworkDesign[],
  random: () => number,
  fallback: FireworkDesign,
): FireworkDesign {
  return designs[Math.floor(random() * designs.length)] ?? fallback;
}

export function generateFreeShow(
  designs: FireworkDesign[],
  density: number,
  seed: number,
): ShowPlan {
  if (designs.length === 0) {
    throw new Error("At least one firework design is required.");
  }
  const random = seededRandom(seed);
  const safeDensity = Math.min(Math.max(Math.round(density), 0), 2);
  const customDesigns = designs.filter((design) =>
    design.id.startsWith("custom-"),
  );
  const fallback = designs[0];
  const cues: ShowCue[] = [];
  let cueIndex = 0;

  const add = (
    time: number,
    lane: number,
    sizePreset: SizeClass,
    forcedDesign?: FireworkDesign,
  ): void => {
    const design = forcedDesign ?? choose(designs, random, fallback);
    const size = resolveSizePreset(sizePreset);
    const variation = (random() - 0.5) * 0.12;
    cues.push({
      id: `cue-${seed}-${cueIndex++}`,
      time: Math.max(time + variation, 0),
      launcherLane: lane,
      launchAngle: lane * -0.05,
      fireworkDesignID: design.id,
      sizePreset,
      targetHeight: size.targetHeight * (0.97 + random() * 0.06),
      timingVariation: variation,
    });
  };

  // 導入: 色と輪郭を読める小型の単発。
  add(0, 0, "small");
  add(2.8, -0.42, "small");
  if (safeDensity > 0) add(3.3, 0.42, "small");

  // 展開: 必ず一度は保存済みの自作花火を主役にする。
  const custom =
    customDesigns.length > 0
      ? choose(customDesigns, random, fallback)
      : undefined;
  add(6.1, 0.1, "medium", custom);
  add(8.6, -0.68, "medium");
  add(8.6, 0.68, "medium");
  if (safeDensity === 2) {
    add(9.25, -0.22, "small");
    add(9.25, 0.22, "small");
  }

  // 10秒台後半は煙と残光を見せる「間」。
  add(14.2, 0, "large");

  // 終幕: 低い小玉と左右の中玉を重ね、最後は大玉一発。
  const finaleStart = 18.4;
  const finaleCount = [3, 5, 7][safeDensity];
  for (let index = 0; index < finaleCount; index += 1) {
    const lane = ((index % 3) - 1) * 0.66;
    add(finaleStart + index * 0.42, lane, index % 2 === 0 ? "small" : "medium");
  }
  add(22.4, -0.72, "medium");
  add(22.4, 0.72, "medium");
  add(24.1, 0, "large", custom);

  const titleOptions = ["湖畔の序章", "風渡る彩霞", "星屑の水鏡", "錦秋の余韻"];
  return {
    id: `free-${seed}`,
    title: titleOptions[Math.floor(random() * titleOptions.length)],
    duration: 29,
    cues: cues.sort((left, right) => left.time - right.time),
  };
}

export function describeShowPhase(time: number): string {
  if (time < 5) return "導入 · テーマ色を提示";
  if (time < 11) return "展開 · 左右へ広がる連続打上";
  if (time < 17.5) return "間 · 煙と残光を鑑賞";
  if (time < 25) return "終幕 · スターマイン";
  return "余韻 · 次の演目へ";
}
