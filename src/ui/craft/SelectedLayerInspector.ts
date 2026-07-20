import type { FireworkDesignV4, LayerIntentV4 } from "../../data";
import { effectivePatternScale, patternScaleLimit } from "./PatternRecipe";
import { escapeHTML, layerAuthoringLabel } from "./viewUtils";

function selectedAttribute(selected: boolean): string {
  return selected ? "selected" : "";
}

export function renderSelectedLayerInspector(
  design: FireworkDesignV4,
  selectedLayer: LayerIntentV4 | undefined,
): string {
  const locked = selectedLayer?.locked ?? true;
  const disabled = locked ? "disabled" : "";
  const nameValue = selectedLayer ? escapeHTML(selectedLayer.name) : "";
  const namePlaceholder = selectedLayer ? "レイヤー名" : "レイヤーを選択";
  const badge = selectedLayer
    ? `${layerAuthoringLabel(selectedLayer)}${selectedLayer.locked ? " · ロック中" : ""}`
    : "未選択";
  let fields = `<p class="inspector-empty">左の一覧からレイヤーを選んでください。</p>`;
  if (selectedLayer) {
    const starOptions = Object.values(design.starDefinitions)
      .map(
        (star) =>
          `<option value="${star.id}" ${selectedAttribute(star.id === selectedLayer.defaultStarId)}>${escapeHTML(star.displayName)}</option>`,
      )
      .join("");
    let specific = "";
    if (selectedLayer.authoringMode === "preset") {
      const parameters = selectedLayer.parameters;
      if (selectedLayer.presetKind === "branch") {
        specific = `<label><span>枝数 <output>${parameters.branchCount}</output></span><input name="branch-count" type="range" min="5" max="20" value="${parameters.branchCount}" aria-label="枝数" aria-valuetext="${parameters.branchCount}本" ${disabled} /></label>`;
      } else if (selectedLayer.presetKind === "child") {
        specific = `<label><span>子花数 <output>${parameters.count}</output></span><input name="child-count" type="range" min="4" max="48" value="${parameters.count}" aria-label="子花数" aria-valuetext="${parameters.count}個" ${disabled} /></label>`;
      } else {
        specific = `<label><span>既定配置</span><select name="preset-kind" ${disabled}><option value="outer" ${selectedAttribute(selectedLayer.presetKind === "outer")}>外周</option><option value="core" ${selectedAttribute(selectedLayer.presetKind === "core")}>芯</option></select></label>
          <label><span>仮想星数 <output>${parameters.count}</output></span><input name="layer-count" type="range" min="12" max="900" value="${parameters.count}" aria-label="仮想星数" aria-valuetext="${parameters.count}個" ${disabled} /></label>
          <label><span>玉内の半径 <output>${Math.round(parameters.radius * 100)}%</output></span><input name="layer-radius" type="range" min="20" max="100" value="${Math.round(parameters.radius * 100)}" aria-label="玉内の半径" aria-valuetext="${Math.round(parameters.radius * 100)}パーセント" ${disabled} /></label>`;
      }
    } else if (selectedLayer.authoringMode === "pattern") {
      const effectiveScale = effectivePatternScale(selectedLayer.pattern);
      const maximumScale = patternScaleLimit(
        selectedLayer.pattern.section,
        selectedLayer.pattern.template,
      );
      specific = `<label><span>大きさ <output>${Math.round(effectiveScale * 100)}%</output></span><input name="pattern-scale" type="range" min="15" max="${Math.round(maximumScale * 100)}" value="${Math.round(effectiveScale * 100)}" aria-label="型物の大きさ" aria-valuetext="${Math.round(effectiveScale * 100)}パーセント" ${disabled} /></label>
        <label><span>点の密度 <output>${selectedLayer.pattern.density}</output></span><input name="pattern-density" type="range" min="12" max="240" value="${selectedLayer.pattern.density}" aria-label="型物の点の密度" aria-valuetext="${selectedLayer.pattern.density}個" ${disabled} /></label>
        <label><span>回転 <output>${selectedLayer.pattern.rotationDegrees}°</output></span><input name="pattern-rotation" type="range" min="0" max="345" step="15" value="${selectedLayer.pattern.rotationDegrees}" aria-label="型物の回転" aria-valuetext="${selectedLayer.pattern.rotationDegrees}度" ${disabled} /></label>
        <p class="inspector-note">型物の生成点は個別編集できません。断面は中央のワークベンチで選びます。</p>`;
    } else {
      specific = `<p class="inspector-note">手動レイヤーでは、表示中の断面上にある仮想星を1点ずつ編集できます。</p>`;
    }
    fields = `<div class="inspector-fields">
      <label><span>既定の仮想星</span><select name="layer-star" ${disabled}>${starOptions}</select></label>
      ${specific}
    </div>`;
  }
  return `<section class="craft-card inspector-card" data-selected-layer-inspector>
    <header>
      <span>選択レイヤー</span>
      <label class="inspector-title-field"><span class="visually-hidden">レイヤー名</span><input name="layer-name" type="text" maxlength="24" value="${nameValue}" placeholder="${namePlaceholder}" aria-label="${namePlaceholder}" ${disabled} /></label>
      <strong>${badge}</strong>
    </header>
    <div class="inspector-body">${fields}</div>
  </section>`;
}
