import type { FireworkDesign, FireworkLayer } from "../../data";

export interface ApproximateSpreadBand {
  color: number;
  delay: number;
  radius: number;
  strength: number;
}

export interface ApproximateSpreadModel {
  bands: ApproximateSpreadBand[];
  duration: number;
  layerCount: number;
}

function layerCount(layer: FireworkLayer): number {
  if (layer.kind === "spherical" || layer.kind === "child") return layer.count;
  if (layer.kind === "pattern") return layer.points.length;
  return layer.branchCount * layer.starsPerBranch;
}

function layerRadius(layer: FireworkLayer): number {
  if (layer.kind === "spherical") return layer.radius;
  if (layer.kind === "child") return 0.62 + layer.scale * 0.2;
  if (layer.kind === "pattern") return 0.84;
  return 0.92;
}

export function buildApproximateSpreadModel(
  design: FireworkDesign,
): ApproximateSpreadModel {
  const layers = design.layers.filter((layer) => layer.visible).slice(0, 12);
  const bands = layers.map((layer, index) => {
    const star = design.starDefinitions[layer.defaultStarId];
    const count = layerCount(layer);
    return {
      color:
        star?.colorStages[Math.min(1, star.colorStages.length - 1)]?.color ??
        star?.colorStages[0]?.color ??
        0xffffff,
      delay: Math.min(index * 0.08, 0.72),
      radius: Math.min(Math.max(layerRadius(layer), 0.2), 1),
      strength: Math.min(0.35 + Math.log2(Math.max(count, 2)) / 12, 1),
    };
  });
  return {
    bands,
    duration: 2.4,
    layerCount: layers.length,
  };
}

function colorToCSS(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function renderApproximateSpread(
  model: ApproximateSpreadModel,
  running: boolean,
  revision: number,
): string {
  const bands = model.bands
    .map((band, index) => {
      const angle = ((index * 137.5 + revision * 11) * Math.PI) / 180;
      const x = 100 + Math.cos(angle) * 9;
      const y = 82 + Math.sin(angle) * 7;
      return `<g style="--spread-color:${colorToCSS(band.color)};--spread-delay:${band.delay}s;--spread-radius:${band.radius};--spread-strength:${band.strength}" class="approximate-spread-band">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" />
        ${Array.from({ length: 8 }, (_, particle) => {
          const particleAngle = (particle / 8) * Math.PI * 2;
          return `<circle cx="${(x + Math.cos(particleAngle) * 22 * band.radius).toFixed(1)}" cy="${(y + Math.sin(particleAngle) * 22 * band.radius).toFixed(1)}" r="2.4" />`;
        }).join("")}
      </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 200 164" class="approximate-spread ${running ? "is-running" : "is-paused"}" role="img" aria-label="${model.layerCount}レイヤーの色と広がりの簡易確認"><circle cx="100" cy="82" r="58" class="approximate-spread-guide" />${bands}</svg>`;
}
