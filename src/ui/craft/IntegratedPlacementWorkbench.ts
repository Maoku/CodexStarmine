import { generateSphereBurst } from "../../core/burst";
import type {
  FireworkDesign,
  FireworkDesignV4,
  FireworkLayer,
  LayerIntentV4,
  SectionRef,
} from "../../data";
import { colorToCSS, escapeHTML } from "./viewUtils";
import {
  clampSectionPoint,
  pointFromSection,
  pointToSection,
  sameSection,
  sectionLabel,
  sectionRadius,
  SECTION_RATIOS,
  type Point3D,
  type SectionPoint2D,
} from "./SectionGeometry";

export type PlacementTemplate = "circle" | "heart" | "manual";
export type TemplateApplyMode = "append" | "replace";

interface WorkbenchPoint {
  color: number;
  editable: boolean;
  index: number;
  layerId: string;
  point: Point3D;
  section?: SectionRef;
  selectedLayer: boolean;
}

const CANVAS_CENTER = { x: 300, y: 272 };
const SPHERE_RADIUS_PX = 214;

function localTemplatePoints(
  template: Exclude<PlacementTemplate, "manual">,
): SectionPoint2D[] {
  if (template === "circle") {
    return Array.from({ length: 36 }, (_, index) => {
      const angle = (index / 36) * Math.PI * 2;
      return { x: Math.cos(angle) * 0.72, y: Math.sin(angle) * 0.72 };
    });
  }
  return Array.from({ length: 44 }, (_, index) => {
    const angle = (index / 44) * Math.PI * 2;
    const rawX = 16 * Math.sin(angle) ** 3;
    const rawY =
      13 * Math.cos(angle) -
      5 * Math.cos(2 * angle) -
      2 * Math.cos(3 * angle) -
      Math.cos(4 * angle);
    return { x: rawX / 22, y: rawY / 22 + 0.04 };
  });
}

export function createPlacementTemplatePoints(
  template: Exclude<PlacementTemplate, "manual">,
  section: SectionRef,
  radius = 1,
): Point3D[] {
  return localTemplatePoints(template).map((point) =>
    pointFromSection(section, point, radius),
  );
}

export function canvasPointOnSection(
  svgX: number,
  svgY: number,
  section: SectionRef,
): SectionPoint2D {
  const pixelRadius = SPHERE_RADIUS_PX * sectionRadius(section);
  return clampSectionPoint({
    x: (svgX - CANVAS_CENTER.x) / pixelRadius,
    y: (CANVAS_CENTER.y - svgY) / pixelRadius,
  });
}

export function projectSectionPoint(
  point: Point3D,
  section: SectionRef,
): { distanceFromPlane: number; x: number; y: number } {
  const projected = pointToSection(section, point);
  const pixelRadius = SPHERE_RADIUS_PX * sectionRadius(section);
  return {
    distanceFromPlane: projected.distanceFromPlane,
    x: CANVAS_CENTER.x + projected.x * pixelRadius,
    y: CANVAS_CENTER.y - projected.y * pixelRadius,
  };
}

function starColor(
  design: FireworkDesign,
  layer: FireworkLayer,
  starId?: string,
): number {
  const star = design.starDefinitions[starId ?? layer.defaultStarId];
  return star?.colorStages[1]?.color ?? star?.colorStages[0]?.color ?? 0xd9d4c9;
}

function presetPoints(
  design: FireworkDesign,
  layer: FireworkLayer,
  selectedLayer: boolean,
): WorkbenchPoint[] {
  const points: WorkbenchPoint[] = [];
  if (layer.kind === "spherical") {
    const generated = generateSphereBurst(layer.count, 1, layer.placementSeed);
    const overrides = new Map(
      layer.overrides.map((override) => [override.index, override]),
    );
    const stride = Math.max(1, Math.ceil(layer.count / 180));
    generated.forEach(({ direction }, index) => {
      if (index % stride !== 0 && !overrides.has(index)) return;
      const override = overrides.get(index);
      if (override?.removed) return;
      points.push({
        color: starColor(design, layer, override?.starId),
        editable: false,
        index,
        layerId: layer.id,
        point: override?.position ?? {
          x: direction.x * layer.radius,
          y: direction.y * layer.radius,
          z: direction.z * layer.radius,
        },
        selectedLayer,
      });
    });
    return points;
  }
  const count =
    layer.kind === "child"
      ? layer.count
      : layer.kind === "branch"
        ? layer.branchCount * Math.min(layer.starsPerBranch, 8)
        : layer.points.length;
  generateSphereBurst(
    Math.min(Math.max(count, 1), 80),
    1,
    design.assemblySeed,
  ).forEach(({ direction }, index) => {
    points.push({
      color: starColor(design, layer),
      editable: false,
      index,
      layerId: layer.id,
      point: direction,
      selectedLayer,
    });
  });
  return points;
}

function workbenchPoints(
  design: FireworkDesign,
  intentDesign: FireworkDesignV4,
  selectedLayerId: string | undefined,
  section: SectionRef,
): WorkbenchPoint[] {
  return design.layers.flatMap((layer) => {
    if (!layer.visible) return [];
    const intent = intentDesign.layers.find(
      (candidate) => candidate.id === layer.id,
    );
    const selectedLayer = layer.id === selectedLayerId;
    if (intent?.authoringMode === "manual") {
      return intent.points.map((point, index) => ({
        color: starColor(design, layer, point.starId),
        editable:
          selectedLayer &&
          !intent.locked &&
          sameSection(point.section, section),
        index,
        layerId: layer.id,
        point: point.position,
        section: point.section,
        selectedLayer,
      }));
    }
    if (intent?.authoringMode === "pattern" && layer.kind === "spherical") {
      return layer.overrides
        .filter((override) => override.position && !override.removed)
        .map((override, index) => ({
          color: starColor(design, layer, override.starId),
          editable: false,
          index,
          layerId: layer.id,
          point: override.position as Point3D,
          section: intent.pattern.section,
          selectedLayer,
        }));
    }
    return presetPoints(design, layer, selectedLayer);
  });
}

function renderSectionControls(section: SectionRef): string {
  return `<div class="section-controls">
    <fieldset><legend>断面の向き</legend>
      <button type="button" data-action="select-section-plane" data-plane="xy" class="${section.plane === "xy" ? "is-active" : ""}" aria-pressed="${section.plane === "xy"}">XY</button>
      <button type="button" data-action="select-section-plane" data-plane="xz" class="${section.plane === "xz" ? "is-active" : ""}" aria-pressed="${section.plane === "xz"}">XZ</button>
    </fieldset>
    <fieldset><legend>断面位置</legend>${SECTION_RATIOS.map((ratio) => `<button type="button" data-action="select-section-ratio" data-ratio="${ratio}" class="${section.ratio === ratio ? "is-active" : ""}" aria-pressed="${section.ratio === ratio}">${Math.round(ratio * 100)}%</button>`).join("")}</fieldset>
  </div>`;
}

export function renderIntegratedPlacementWorkbench(
  design: FireworkDesign,
  intentDesign: FireworkDesignV4,
  selectedLayer: FireworkLayer | undefined,
  selectedIntent: LayerIntentV4 | undefined,
  section: SectionRef,
  placementTemplate: PlacementTemplate,
  selectedPointIndex?: number,
  templateApplyMode: TemplateApplyMode = "replace",
): string {
  const pointEditingAllowed = selectedIntent?.authoringMode === "manual";
  const points = workbenchPoints(
    design,
    intentDesign,
    selectedLayer?.id,
    section,
  )
    .map((item) => {
      const projected = projectSectionPoint(item.point, section);
      const currentSection = item.section
        ? sameSection(item.section, section)
        : false;
      const selected =
        item.editable &&
        item.selectedLayer &&
        item.index === selectedPointIndex;
      const reference = !currentSection || !item.selectedLayer;
      return `<circle
        cx="${projected.x.toFixed(1)}"
        cy="${projected.y.toFixed(1)}"
        r="${selected ? 6.5 : item.selectedLayer ? 4.2 : 2.8}"
        style="--point-color:${colorToCSS(item.color)};--point-depth:${reference ? "0.28" : "0.9"}"
        class="workbench-point${item.selectedLayer ? " is-layer-selected" : ""}${selected ? " is-point-selected" : ""}${reference ? " is-reference" : ""}"
        data-layer-id="${item.layerId}"
        data-point-index="${item.index}"
        data-point-editable="${item.editable}"
        data-current-section="${currentSection}"
      />`;
    })
    .join("");
  const sliceRadius = sectionRadius(section) * SPHERE_RADIUS_PX;
  const patternEditing = selectedIntent?.authoringMode === "pattern";
  const toolControls = pointEditingAllowed
    ? (["circle", "heart", "manual"] as PlacementTemplate[])
        .map(
          (template) =>
            `<button type="button" data-action="placement-template" data-template="${template}" class="${placementTemplate === template ? "is-active" : ""}" aria-pressed="${placementTemplate === template}">${({ circle: "円形", heart: "ハート", manual: "手動" } as const)[template]}</button>`,
        )
        .join("")
    : patternEditing
      ? (["circle", "heart"] as const)
          .map(
            (template) =>
              `<button type="button" data-action="select-pattern-template" data-template="${template}" class="${selectedIntent.pattern.template === template ? "is-active" : ""}" aria-pressed="${selectedIntent.pattern.template === template}">${template === "circle" ? "円形" : "ハート"}</button>`,
          )
          .join("")
      : '<span class="placement-permission-note">このレイヤーはパラメーターで編集します</span>';
  return `<section class="integrated-workbench" aria-labelledby="placement-workbench-title">
    <header class="workbench-heading">
      <div><p>CROSS-SECTION PLACEMENT</p><h2 id="placement-workbench-title">玉内配置ワークベンチ</h2></div>
      <span>${selectedLayer ? escapeHTML(selectedLayer.name) : "レイヤーを選択"} · ${sectionLabel(section)}</span>
    </header>
    ${renderSectionControls(section)}
    <div class="placement-tool-row" aria-label="便利な配置">
      <span>${patternEditing ? "型物の形状" : "便利な配置"}</span>
      ${toolControls}
      ${pointEditingAllowed ? `<label class="template-apply-mode"><span>生成方法</span><select name="template-apply-mode"><option value="replace" ${templateApplyMode === "replace" ? "selected" : ""}>置換</option><option value="append" ${templateApplyMode === "append" ? "selected" : ""}>追加</option></select></label>` : ""}
      ${pointEditingAllowed ? `<button type="button" data-action="delete-point" ${selectedPointIndex === undefined ? "disabled" : ""}>選択点を削除</button>` : ""}
    </div>
    <div class="workbench-canvas-wrap">
      <svg viewBox="0 0 600 544" data-workbench-canvas role="img" aria-label="${sectionLabel(section)}断面と全レイヤーの参照点">
        <defs><radialGradient id="workbench-shell-fill"><stop offset="0" stop-color="#151d24"/><stop offset=".78" stop-color="#0a1117"/><stop offset="1" stop-color="#302416"/></radialGradient></defs>
        <circle cx="300" cy="272" r="224" class="workbench-sphere-reference" />
        <circle cx="300" cy="272" r="${sliceRadius.toFixed(1)}" class="workbench-section-disc" />
        <g class="workbench-section-grid">
          <line x1="${(300 - sliceRadius).toFixed(1)}" y1="272" x2="${(300 + sliceRadius).toFixed(1)}" y2="272" />
          <line x1="300" y1="${(272 - sliceRadius).toFixed(1)}" x2="300" y2="${(272 + sliceRadius).toFixed(1)}" />
        </g>
        <g class="workbench-points">${points}</g>
        <circle cx="300" cy="272" r="${sliceRadius.toFixed(1)}" class="workbench-section-edge" />
      </svg>
      <p>${pointEditingAllowed ? (placementTemplate === "manual" ? "断面円を押して1点追加。現在断面の点だけ移動できます。" : "現在断面へ等間隔配置し、その後は各点を編集できます。") : patternEditing ? "形状は上のボタン、サイズ・密度・回転は右のパラメーターで調整します。" : "生成点は参照表示です。右のパラメーターで調整してください。"}</p>
    </div>
  </section>`;
}
