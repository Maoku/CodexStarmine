import type { FireworkDesign, FireworkLayer } from "../../data";
import { escapeHTML, layerColor, layerKindLabel } from "./viewUtils";

function renderLayerRow(
  design: FireworkDesign,
  layer: FireworkLayer,
  index: number,
  selectedLayerId: string | undefined,
): string {
  return `<article class="layer-row ${layer.id === selectedLayerId ? "is-selected" : ""}" data-layer-id="${layer.id}">
    <button type="button" data-action="toggle-layer" aria-label="${layer.visible ? "非表示にする" : "表示する"}">${layer.visible ? "◉" : "○"}</button>
    <button type="button" data-action="select-layer" aria-pressed="${layer.id === selectedLayerId}"><i style="--layer:${layerColor(design, layer)}"></i><span>${escapeHTML(layer.name)}</span><small>${layerKindLabel(layer)}</small></button>
    <button type="button" data-action="toggle-lock" aria-label="${layer.locked ? "ロック解除" : "ロック"}">${layer.locked ? "▣" : "□"}</button>
    <div class="layer-row__move"><button type="button" data-action="move-layer-up" aria-label="上へ移動" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-layer-down" aria-label="下へ移動" ${index === design.layers.length - 1 ? "disabled" : ""}>↓</button></div>
  </article>`;
}

export function renderLayerPanel(
  design: FireworkDesign,
  selectedLayerId: string | undefined,
): string {
  return `<section class="craft-card layer-card integrated-layer-card">
    <header><span>レイヤー</span><strong>${design.layers.length} 層</strong></header>
    <div class="layer-list">${design.layers.map((layer, index) => renderLayerRow(design, layer, index, selectedLayerId)).join("")}</div>
    <div class="layer-adders">
      <button type="button" data-action="add-core">＋ 芯</button>
      <button type="button" data-action="add-pattern">＋ 型物</button>
      <button type="button" data-action="add-child">＋ 子花</button>
    </div>
  </section>`;
}
