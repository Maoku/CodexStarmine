import type { FireworkDesignV4, LayerIntentV4 } from "../../data";
import { escapeHTML, intentLayerColor, layerAuthoringLabel } from "./viewUtils";

function renderLayerRow(
  design: FireworkDesignV4,
  layer: LayerIntentV4,
  index: number,
  selectedLayerId: string | undefined,
): string {
  const layerName = escapeHTML(layer.name);
  return `<article class="layer-row ${layer.id === selectedLayerId ? "is-selected" : ""}" data-layer-id="${layer.id}">
    <button type="button" data-action="toggle-layer" aria-label="${layerName}を${layer.visible ? "非表示にする" : "表示する"}">${layer.visible ? "◉" : "○"}</button>
    <button type="button" data-action="select-layer" aria-pressed="${layer.id === selectedLayerId}"><i style="--layer:${intentLayerColor(design, layer)}"></i><span>${layerName}</span><small>${layerAuthoringLabel(layer)}</small></button>
    <button type="button" data-action="toggle-lock" aria-label="${layerName}の${layer.locked ? "ロックを解除" : "ロックを有効化"}">${layer.locked ? "▣" : "□"}</button>
    <div class="layer-row__move"><button type="button" data-action="move-layer-up" aria-label="${layerName}を上へ移動" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-layer-down" aria-label="${layerName}を下へ移動" ${index === design.layers.length - 1 ? "disabled" : ""}>↓</button></div>
  </article>`;
}

export function renderLayerPanel(
  design: FireworkDesignV4,
  selectedLayerId: string | undefined,
): string {
  const selectedLayer = design.layers.find(
    (layer) => layer.id === selectedLayerId,
  );
  const deleteDisabled =
    !selectedLayer || selectedLayer.locked || design.layers.length <= 1;
  return `<section class="craft-card layer-card integrated-layer-card">
    <header><span>レイヤー</span><strong>${design.layers.length} 層</strong></header>
    <div class="layer-list">${design.layers.map((layer, index) => renderLayerRow(design, layer, index, selectedLayerId)).join("")}</div>
    <div class="layer-adders">
      <details class="preset-layer-menu"><summary>＋ 既定</summary><div>
        <button type="button" data-action="add-preset" data-preset-kind="outer">外周</button>
        <button type="button" data-action="add-preset" data-preset-kind="core">芯</button>
        <button type="button" data-action="add-preset" data-preset-kind="child">子花</button>
        <button type="button" data-action="add-preset" data-preset-kind="branch">枝</button>
      </div></details>
      <button type="button" data-action="add-pattern">＋ 型物</button>
      <button type="button" data-action="add-manual">＋ 手動</button>
    </div>
    <div class="layer-lifecycle-actions">
      <button type="button" data-action="duplicate-layer" ${selectedLayer ? "" : "disabled"}>選択レイヤーを複製</button>
      <button type="button" data-action="delete-layer" ${deleteDisabled ? "disabled" : ""}>削除</button>
    </div>
  </section>`;
}
