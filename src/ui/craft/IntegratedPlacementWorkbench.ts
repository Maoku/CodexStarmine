import { generateSphereBurst } from "../../core/burst";
import type {
  FireworkDesign,
  FireworkDesignV4,
  FireworkLayer,
  LayerIntentV4,
  PatternTemplate,
  SectionRef,
} from "../../data";
import {
  DEFAULT_MANUAL_PLACEMENT_SETTINGS,
  type ManualPlacementKind,
  type ManualPlacementSettings,
} from "./ManualPlacementRecipe";
import {
  DEFAULT_IMAGE_PLACEMENT_SETTINGS,
  IMAGE_PLACEMENT_MAXIMUM_POINTS,
  IMAGE_PLACEMENT_MINIMUM_POINTS,
} from "./ImagePlacementRecipe";
import { PATTERN_TEMPLATE_LABELS, PATTERN_TEMPLATES } from "./PatternRecipe";
import { colorToCSS, escapeHTML } from "./viewUtils";
import {
  clampSectionPoint,
  pointFromSection,
  pointToSection,
  sameSection,
  sectionRadius,
  sectionRatioIndex,
  type Point3D,
  type SectionPoint2D,
} from "./SliceGeometry";
import { renderShellSliceNavigator } from "./ShellSliceNavigator";
import {
  clampPointToSectionDisc,
  DEFAULT_WORKBENCH_VIEW_STATE,
  normalizeWorkbenchViewState,
  projectWorkbenchPoint,
  projectWorkbenchSectionOutline,
  stableDepthSort,
  unprojectWorkbenchPointToSection,
  type WorkbenchViewState,
} from "./WorkbenchViewGeometry";

export type PlacementTemplate = ManualPlacementKind | "image" | "manual";
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

function localTemplatePoints(template: "circle" | "heart"): SectionPoint2D[] {
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
  template: "circle" | "heart",
  section: SectionRef,
  radius = 1,
): Point3D[] {
  return localTemplatePoints(template).map((point) =>
    pointFromSection(section, point, radius),
  );
}

function renderManualRecipeControls(
  kind: PlacementTemplate,
  settings: ManualPlacementSettings,
  imageTargetCount: number,
): string {
  if (kind === "manual") return "";
  if (kind === "image") {
    return `<div class="manual-recipe-controls image-placement-controls"><label><span>既定の目標点数</span><input name="image-target-count" type="number" min="${IMAGE_PLACEMENT_MINIMUM_POINTS}" max="${IMAGE_PLACEMENT_MAXIMUM_POINTS}" value="${imageTargetCount}" /></label><span>画像を選ぶと、被写体・特徴・背景の点指定画面が開きます。</span></div>`;
  }
  const count = `<label><span>個数</span><input name="manual-count" type="number" min="2" max="240" value="${settings.count}" /></label>`;
  const rotation = `<label><span>回転</span><input name="manual-rotation" type="number" min="-360" max="360" value="${settings.rotationDegrees}" /></label>`;
  let parameters: string;
  if (kind === "circle") {
    parameters = `${count}<label><span>半径</span><input name="manual-radius" type="number" min="5" max="94" value="${Math.round(settings.radius * 100)}" /></label>${rotation}`;
  } else if (kind === "line") {
    parameters = `${count}<label><span>長さ</span><input name="manual-length" type="number" min="10" max="188" value="${Math.round(settings.length * 100)}" /></label><label><span>角度</span><input name="manual-angle" type="number" min="-360" max="360" value="${settings.angleDegrees}" /></label>`;
  } else if (kind === "arc") {
    parameters = `${count}<label><span>半径</span><input name="manual-radius" type="number" min="5" max="94" value="${Math.round(settings.radius * 100)}" /></label><label><span>開始角</span><input name="manual-start-angle" type="number" min="-360" max="360" value="${settings.startAngleDegrees}" /></label><label><span>終了角</span><input name="manual-end-angle" type="number" min="-360" max="360" value="${settings.endAngleDegrees}" /></label>`;
  } else {
    parameters = `<label><span>行</span><input name="manual-rows" type="number" min="1" max="20" value="${settings.rows}" /></label><label><span>列</span><input name="manual-columns" type="number" min="1" max="20" value="${settings.columns}" /></label><label><span>間隔</span><input name="manual-spacing" type="number" min="4" max="45" value="${Math.round(settings.spacing * 100)}" /></label>${rotation}`;
  }
  return `<div class="manual-recipe-controls">${parameters}<button type="button" data-action="apply-manual-recipe">生成</button></div>`;
}

export function canvasPointOnSection(
  svgX: number,
  svgY: number,
  section: SectionRef,
  viewState: WorkbenchViewState = DEFAULT_WORKBENCH_VIEW_STATE,
): SectionPoint2D {
  const point = unprojectWorkbenchPointToSection(
    { x: svgX, y: svgY },
    section,
    viewState,
  );
  if (point) {
    const local = pointToSection(
      section,
      clampPointToSectionDisc(point, section),
    );
    return clampSectionPoint(local);
  }
  const pixelRadius = SPHERE_RADIUS_PX * sectionRadius(section);
  return clampSectionPoint({
    x: (svgX - CANVAS_CENTER.x) / pixelRadius,
    y: (CANVAS_CENTER.y - svgY) / pixelRadius,
  });
}

export function projectSectionPoint(
  point: Point3D,
  section: SectionRef,
  viewState: WorkbenchViewState = DEFAULT_WORKBENCH_VIEW_STATE,
): {
  depth: number;
  distanceFromPlane: number;
  visualScale: number;
  x: number;
  y: number;
} {
  const local = pointToSection(section, point);
  const projected = projectWorkbenchPoint(point, viewState);
  return {
    ...projected,
    distanceFromPlane: local.distanceFromPlane,
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

function pathForProjectedPoints(
  points: ReadonlyArray<{ x: number; y: number }>,
): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ")
    .concat(" Z");
}

function sectionStepLabel(section: SectionRef): string {
  const index = sectionRatioIndex(section.ratio);
  const position = index < 2 ? "手前" : index === 2 ? "中央" : "奥";
  return `${position} ${index + 1} / 5`;
}

function renderWorkbenchViewControls(
  section: SectionRef,
  viewState: WorkbenchViewState,
): string {
  const state = normalizeWorkbenchViewState(viewState);
  const zoomPercent = Math.round(state.zoom * 100);
  const stepIndex = sectionRatioIndex(section.ratio);
  const stepLabel = sectionStepLabel(section);
  return `<div class="workbench-view-toolbar">
    <label class="workbench-section-control"><span>面位置</span><input name="section-step" data-section-step type="range" min="0" max="4" step="1" value="${stepIndex}" aria-label="操作面の位置" aria-valuetext="${section.plane.toUpperCase()}面 ${stepLabel}" /><output>${section.plane.toUpperCase()} · ${stepLabel}</output></label>
    <label class="workbench-zoom-control"><span>表示</span><input name="workbench-zoom" data-workbench-zoom type="range" min="50" max="200" step="10" value="${zoomPercent}" aria-label="玉の表示倍率" aria-valuetext="${zoomPercent}パーセント" /><output>${zoomPercent}%</output></label>
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
  sliceAnnouncement = "",
  manualPlacementSettings: ManualPlacementSettings = DEFAULT_MANUAL_PLACEMENT_SETTINGS,
  imageTargetCount = DEFAULT_IMAGE_PLACEMENT_SETTINGS.targetCount,
  imageImporting = false,
  viewState: WorkbenchViewState = DEFAULT_WORKBENCH_VIEW_STATE,
): string {
  const normalizedView = normalizeWorkbenchViewState(viewState);
  const pointEditingAllowed = selectedIntent?.authoringMode === "manual";
  const points = stableDepthSort(
    workbenchPoints(design, intentDesign, selectedLayer?.id, section).map(
      (item) => ({
        item,
        projected: projectSectionPoint(item.point, section, normalizedView),
      }),
    ),
    ({ projected }) => projected.depth,
  )
    .map(({ item, projected }) => {
      const currentSection = item.section
        ? sameSection(item.section, section)
        : false;
      const selected =
        item.editable &&
        item.selectedLayer &&
        item.index === selectedPointIndex;
      const reference = !currentSection || !item.selectedLayer;
      const depthOpacity = Math.min(
        Math.max(0.38 + (projected.depth + 1) * 0.24, 0.24),
        0.95,
      );
      const pointOpacity = reference
        ? Math.min(depthOpacity, 0.42)
        : depthOpacity;
      const radius =
        (selected ? 6.5 : item.selectedLayer ? 4.2 : 2.8) *
        projected.visualScale;
      const attributes = `data-layer-id="${item.layerId}" data-point-index="${item.index}" data-point-editable="${item.editable}" data-current-section="${currentSection}"`;
      const hitTarget = item.editable
        ? `<circle cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="16" class="workbench-point-hit" ${attributes} />`
        : "";
      return `${hitTarget}<circle
        cx="${projected.x.toFixed(1)}"
        cy="${projected.y.toFixed(1)}"
        r="${radius.toFixed(2)}"
        style="--point-color:${colorToCSS(item.color)};--point-depth:${pointOpacity.toFixed(2)}"
        class="workbench-point${item.selectedLayer ? " is-layer-selected" : ""}${selected ? " is-point-selected" : ""}${reference ? " is-reference" : ""}"
        data-point-visual="true"
        data-point-depth="${projected.depth.toFixed(4)}"
        ${attributes}
      />`;
    })
    .join("");
  const sectionOutline = projectWorkbenchSectionOutline(
    section,
    normalizedView,
  );
  const sectionPath = pathForProjectedPoints(sectionOutline);
  const horizontalStart = projectSectionPoint(
    pointFromSection(section, { x: -1, y: 0 }),
    section,
    normalizedView,
  );
  const horizontalEnd = projectSectionPoint(
    pointFromSection(section, { x: 1, y: 0 }),
    section,
    normalizedView,
  );
  const verticalStart = projectSectionPoint(
    pointFromSection(section, { x: 0, y: -1 }),
    section,
    normalizedView,
  );
  const verticalEnd = projectSectionPoint(
    pointFromSection(section, { x: 0, y: 1 }),
    section,
    normalizedView,
  );
  const shellRadius = 224 * normalizedView.zoom;
  const highlightX = 258 + (normalizedView.yawDegrees / 180) * 18;
  const highlightY = 226 - (normalizedView.pitchDegrees / 60) * 14;
  const patternEditing = selectedIntent?.authoringMode === "pattern";
  const toolControls = pointEditingAllowed
    ? (["manual", "circle", "line", "arc", "grid"] as const)
        .map(
          (template) =>
            `<button type="button" data-action="placement-template" data-template="${template}" class="${placementTemplate === template ? "is-active" : ""}" aria-pressed="${placementTemplate === template}">${({ manual: "1点", circle: "円周", line: "直線", arc: "円弧", grid: "格子" } as const)[template]}</button>`,
        )
        .join("") +
      `<button type="button" data-action="import-image-placement" data-template="image" class="${placementTemplate === "image" ? "is-active" : ""}" aria-pressed="${placementTemplate === "image"}" aria-label="画像から仮想星を生成" ${imageImporting ? "disabled" : ""}>${imageImporting ? "点指定中…" : "画像から生成"}</button>`
    : patternEditing
      ? PATTERN_TEMPLATES.map(
          (template: PatternTemplate) =>
            `<button type="button" data-action="select-pattern-template" data-template="${template}" class="${selectedIntent.pattern.template === template ? "is-active" : ""}" aria-pressed="${selectedIntent.pattern.template === template}">${PATTERN_TEMPLATE_LABELS[template]}</button>`,
        ).join("")
      : '<span class="placement-permission-note">このレイヤーはパラメーターで編集します</span>';
  return `<section class="integrated-workbench" aria-labelledby="placement-workbench-title">
    <header class="workbench-heading">
      <div><p>CROSS-SECTION PLACEMENT</p><h2 id="placement-workbench-title">玉内配置ワークベンチ</h2></div>
      <span>${selectedLayer ? escapeHTML(selectedLayer.name) : "レイヤーを選択"}</span>
    </header>
    <div class="placement-tool-row" aria-label="便利な配置">
      <span>${patternEditing ? "形状" : "便利な配置"}</span>
      ${toolControls}
      ${pointEditingAllowed ? renderManualRecipeControls(placementTemplate, manualPlacementSettings, imageTargetCount) : ""}
      ${pointEditingAllowed ? `<label class="template-apply-mode"><span>生成方法</span><select name="template-apply-mode"><option value="replace" ${templateApplyMode === "replace" ? "selected" : ""}>置換</option><option value="append" ${templateApplyMode === "append" ? "selected" : ""}>追加</option></select></label>` : ""}
      ${pointEditingAllowed ? `<button type="button" data-action="delete-point" ${selectedPointIndex === undefined ? "disabled" : ""}>選択点を削除</button>` : ""}
    </div>
    <div class="workbench-canvas-wrap">
      <div class="workbench-view-cluster" aria-label="操作面と表示倍率">
        ${renderShellSliceNavigator(section)}
        ${renderWorkbenchViewControls(section, normalizedView)}
      </div>
      <svg viewBox="0 0 600 544" data-workbench-canvas role="img" aria-label="選択中の切断面と全レイヤーの参照点">
        <defs>
          <radialGradient id="workbench-shell-fill" cx="35%" cy="28%"><stop offset="0" stop-color="#33444d"/><stop offset=".46" stop-color="#151d24"/><stop offset=".82" stop-color="#0a1117"/><stop offset="1" stop-color="#302416"/></radialGradient>
          <radialGradient id="workbench-shell-highlight"><stop stop-color="#fff" stop-opacity=".23"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        </defs>
        <circle cx="300" cy="272" r="${shellRadius.toFixed(1)}" class="workbench-sphere-reference" />
        <path d="M${(300 - shellRadius).toFixed(1)} 272 A${shellRadius.toFixed(1)} ${shellRadius.toFixed(1)} 0 0 0 ${(300 + shellRadius).toFixed(1)} 272" class="workbench-sphere-rear" />
        <ellipse cx="${highlightX.toFixed(1)}" cy="${highlightY.toFixed(1)}" rx="${(shellRadius * 0.42).toFixed(1)}" ry="${(shellRadius * 0.3).toFixed(1)}" class="workbench-sphere-highlight" />
        <path d="${sectionPath}" class="workbench-section-disc" />
        <g class="workbench-section-grid">
          <line x1="${horizontalStart.x.toFixed(1)}" y1="${horizontalStart.y.toFixed(1)}" x2="${horizontalEnd.x.toFixed(1)}" y2="${horizontalEnd.y.toFixed(1)}" />
          <line x1="${verticalStart.x.toFixed(1)}" y1="${verticalStart.y.toFixed(1)}" x2="${verticalEnd.x.toFixed(1)}" y2="${verticalEnd.y.toFixed(1)}" />
        </g>
        <g class="workbench-points">${points}</g>
        <path d="${sectionPath}" class="workbench-section-edge" />
        <circle cx="300" cy="272" r="${shellRadius.toFixed(1)}" class="workbench-sphere-front" />
      </svg>
      <p class="slice-announcement" aria-live="polite">${escapeHTML(sliceAnnouncement)}</p>
      <p>${pointEditingAllowed ? (placementTemplate === "manual" ? "断面円を押して1点追加。現在断面の点だけ移動できます。" : placementTemplate === "image" ? "画像上で被写体・特徴・除外背景を指定し、確認後に現在断面へ配置します。" : "現在断面へ等間隔配置し、その後は各点を編集できます。") : patternEditing ? "形状は上のボタン、サイズ・密度・回転は右のパラメーターで調整します。" : "生成点は参照表示です。右のパラメーターで調整してください。"}</p>
    </div>
  </section>`;
}
