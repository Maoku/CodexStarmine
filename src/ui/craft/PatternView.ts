import type { FireworkDesign, PatternStarLayer } from "../../data";
import { deriveVirtualBehavior } from "../../core/burst";
import { colorToCSS, escapeHTML } from "./viewUtils";

export function renderPatternView(
  design: FireworkDesign,
  layer?: PatternStarLayer,
  tool = "select",
): string {
  if (!layer) {
    return `<div class="pattern-empty"><strong>型物レイヤーを選択</strong><p>左の「型物を追加」から、玉内の平面配置ガイドを作成します。</p></div>`;
  }
  const groups = new Map(layer.groups.map((group) => [group.id, group]));
  const defaultStar = design.starDefinitions[layer.defaultStarId];
  const orientationDegrees =
    design.schemaVersion === 3 && defaultStar
      ? deriveVirtualBehavior({
          assemblySeed: design.assemblySeed,
          derivationVersion: design.derivationVersion,
          layer,
          localDensity: Math.min(layer.points.length / 320, 1),
          normalizedPosition: { x: 1, y: 0, z: 0 },
          sizeClass: design.sizeClass,
          star: defaultStar,
        }).orientationDegrees
      : layer.orientationDegrees;
  const points = layer.points
    .map((point, index) => {
      const group = groups.get(point.groupId);
      const definition =
        design.starDefinitions[group?.starId ?? layer.defaultStarId];
      const color = colorToCSS(
        definition?.colorStages[1]?.color ??
          definition?.colorStages[0]?.color ??
          0xffffff,
      );
      return `<circle cx="${220 + point.x * 155}" cy="${190 - point.y * 155}" r="5.5" fill="${color}" data-pattern-point="${index}" />`;
    })
    .join("");
  const groupRows = layer.groups
    .map(
      (group) =>
        `<span><i style="background:${colorToCSS(design.starDefinitions[group.starId]?.colorStages[1]?.color ?? 0xffffff)}"></i>${escapeHTML(group.name)}</span>`,
    )
    .join("");
  return `
    <div class="pattern-view">
      <div class="pattern-toolbar" role="toolbar" aria-label="型物配置ツール">
        ${["select", "pen", "line", "circle", "bezier"].map((name) => `<button type="button" data-action="pattern-tool" data-tool="${name}" class="${tool === name ? "is-active" : ""}">${({ select: "選択", pen: "ペン", line: "直線", circle: "円", bezier: "曲線" } as Record<string, string>)[name]}</button>`).join("")}
        <span class="pattern-toolbar__spacer"></span>
        ${["heart", "circle", "smile"].map((name) => `<button type="button" data-action="pattern-template" data-template="${name}">${({ heart: "ハート", circle: "円形", smile: "笑顔" } as Record<string, string>)[name]}</button>`).join("")}
      </div>
      <svg viewBox="0 0 440 380" data-pattern-canvas role="img" aria-label="${escapeHTML(layer.name)}の玉内配置ガイド">
        <rect x="10" y="10" width="420" height="360" rx="18" class="pattern-grid-bg" />
        <path d="M220 28v324M28 190h384" class="pattern-axis" />
        <circle cx="220" cy="190" r="156" class="pattern-boundary" />
        ${points}
        <path d="M220 190l${Math.sin((orientationDegrees / 180) * Math.PI) * 70} ${-Math.cos((orientationDegrees / 180) * Math.PI) * 70}" class="pattern-facing" />
      </svg>
      <div class="pattern-groups">${groupRows}</div>
      <p>これは玉内の配置ガイドです。空中で開いた完成形は表示していません。</p>
    </div>`;
}
