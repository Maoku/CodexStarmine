import type { FireworkDesign, FireworkLayer } from "../../data";
import { colorToCSS } from "../../ui/craft/viewUtils";

function layerRadius(layer: FireworkLayer, index: number): number {
  if (layer.kind === "spherical") return 45 + layer.radius * 128;
  if (layer.kind === "pattern") return 112;
  if (layer.kind === "branch") return 136;
  return 62 + index * 15;
}

function layerCount(layer: FireworkLayer): number {
  if (layer.kind === "spherical") return layer.count;
  if (layer.kind === "pattern") return layer.points.length;
  if (layer.kind === "branch") return layer.branchCount * layer.starsPerBranch;
  return layer.count;
}

function starColor(design: FireworkDesign, layer: FireworkLayer): string {
  const definition = design.starDefinitions[layer.defaultStarId];
  return colorToCSS(
    definition?.colorStages[1]?.color ??
      definition?.colorStages[0]?.color ??
      0xd8c8a9,
  );
}

export class ShellAssemblyRenderer {
  render(
    design: FireworkDesign,
    selectedLayerId?: string,
    hemisphere: "left" | "right" = "left",
  ): string {
    const centerX = hemisphere === "left" ? 254 : 266;
    const layers = design.layers
      .filter((layer) => layer.visible)
      .map((layer, layerIndex) => {
        const radius = layerRadius(layer, layerIndex);
        const count = Math.min(Math.max(layerCount(layer), 8), 72);
        const color = starColor(design, layer);
        const stars = Array.from({ length: count }, (_, index) => {
          const angle = (index / count) * Math.PI * 2 + (layerIndex % 2) * 0.07;
          const irregularity =
            layer.kind === "spherical" ? layer.jitter * 7 : 0;
          const x =
            centerX +
            Math.cos(angle) * (radius + Math.sin(index * 7) * irregularity);
          const y =
            220 +
            Math.sin(angle) *
              (radius * 0.69 + Math.cos(index * 5) * irregularity);
          const size = layer.kind === "child" ? 5 : 7.5;
          return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${size}" fill="${color}" data-star-index="${index}" />`;
        }).join("");
        return `
          <g class="assembly-layer ${layer.id === selectedLayerId ? "is-selected" : ""}" data-layer-id="${layer.id}">
            <ellipse cx="${centerX}" cy="220" rx="${radius}" ry="${radius * 0.69}" class="assembly-guide" />
            ${stars}
          </g>`;
      })
      .join("");

    return `
      <div class="assembly-scene" data-drop-zone="assembly" aria-label="仮想星を玉皮へ仕込む半球組立台">
        <svg viewBox="0 0 520 440" role="img" aria-label="${hemisphere === "left" ? "左" : "右"}半球の内部配置">
          <defs>
            <radialGradient id="shell-paper" cx="48%" cy="42%">
              <stop offset="0" stop-color="#8a7658" />
              <stop offset="0.68" stop-color="#5d4a35" />
              <stop offset="1" stop-color="#2f241b" />
            </radialGradient>
            <filter id="star-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".7" /></filter>
          </defs>
          <ellipse cx="${centerX}" cy="220" rx="220" ry="174" fill="url(#shell-paper)" stroke="#c79a5c" stroke-width="3" />
          <ellipse cx="${centerX}" cy="220" rx="191" ry="145" fill="#12171a" stroke="#a27b4e" stroke-width="10" />
          <g filter="url(#star-shadow)">${layers}</g>
          <circle cx="${centerX}" cy="220" r="28" fill="#6c5940" stroke="#a98b60" stroke-width="3" />
          <path d="M${centerX - 28} 220h56M${centerX} 192v56" stroke="#33291e" stroke-width="2" />
        </svg>
        <p class="assembly-hint">部品皿から仮想星をドラッグ。選択レイヤーへ列詰めします。</p>
      </div>`;
  }
}
