import type { FireworkDesign } from "../../data";
import { escapeHTML, layerColor, layerKindLabel } from "./viewUtils";

export function renderSectionView(
  design: FireworkDesign,
  selectedLayerId?: string,
): string {
  const visible = design.layers.filter((layer) => layer.visible);
  const circles = visible
    .map((layer, index) => {
      const radius =
        layer.kind === "spherical"
          ? 42 + layer.radius * 125
          : layer.kind === "pattern"
            ? 116
            : layer.kind === "branch"
              ? 154
              : 52 + index * 17;
      return `<circle cx="230" cy="190" r="${radius}" fill="none" stroke="${layerColor(design, layer)}" stroke-width="${layer.id === selectedLayerId ? 9 : 5}" opacity="${layer.id === selectedLayerId ? 1 : 0.65}" data-layer-id="${layer.id}" />`;
    })
    .reverse()
    .join("");
  const legend = visible
    .map(
      (layer) =>
        `<li><i style="--layer-color:${layerColor(design, layer)}"></i><strong>${escapeHTML(layer.name)}</strong><span>${layerKindLabel(layer)}</span></li>`,
    )
    .join("");
  return `
    <div class="section-view">
      <svg viewBox="0 0 460 380" role="img" aria-label="玉皮内部の同心レイヤー断面">
        <circle cx="230" cy="190" r="176" class="section-shell" />
        ${circles}
        <circle cx="230" cy="190" r="18" class="section-center" />
        <path d="M230 14v352M54 190h352" class="section-axis" />
      </svg>
      <ul class="section-legend">${legend}</ul>
      <p>相対比だけを表示しています。実寸・材料・製造条件は扱いません。</p>
    </div>`;
}
