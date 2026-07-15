import { generateSphereBurst } from "../../core/burst";
import type { FireworkDesign, FireworkLayer } from "../../data";
import { colorToCSS, escapeHTML } from "./viewUtils";

export type PlacementTemplate = "circle" | "heart" | "manual";

export interface PlacementFace {
  latitudeBand: number;
  longitudeSector: number;
  rotationDegrees: number;
}

export interface NormalizedPlacementPoint {
  x: number;
  y: number;
  z: number;
}

interface WorkbenchPoint {
  color: number;
  editable: boolean;
  index: number;
  layerId: string;
  point: NormalizedPlacementPoint;
  selectedLayer: boolean;
}

const LATITUDE_LABELS = ["南・外", "南・内", "北・内", "北・外"];
const LONGITUDE_LABELS = ["西・奥", "西・手前", "東・手前", "東・奥"];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalize(point: NormalizedPlacementPoint): NormalizedPlacementPoint {
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return {
    x: point.x / length,
    y: point.y / length,
    z: point.z / length,
  };
}

export function normalizePlacementFace(face: PlacementFace): PlacementFace {
  return {
    latitudeBand: Math.round(clamp(face.latitudeBand, 0, 3)),
    longitudeSector: Math.round(clamp(face.longitudeSector, 0, 3)),
    rotationDegrees: ((Math.round(face.rotationDegrees) % 360) + 360) % 360,
  };
}

function placementBasis(face: PlacementFace): {
  east: NormalizedPlacementPoint;
  north: NormalizedPlacementPoint;
  normal: NormalizedPlacementPoint;
} {
  const safeFace = normalizePlacementFace(face);
  const latitude = ((-67.5 + safeFace.latitudeBand * 45) * Math.PI) / 180;
  const longitude =
    ((-135 + safeFace.longitudeSector * 90 + safeFace.rotationDegrees) *
      Math.PI) /
    180;
  const cosLatitude = Math.cos(latitude);
  return {
    east: { x: -Math.sin(longitude), y: 0, z: Math.cos(longitude) },
    north: {
      x: -Math.sin(latitude) * Math.cos(longitude),
      y: cosLatitude,
      z: -Math.sin(latitude) * Math.sin(longitude),
    },
    normal: {
      x: cosLatitude * Math.cos(longitude),
      y: Math.sin(latitude),
      z: cosLatitude * Math.sin(longitude),
    },
  };
}

export function placementFaceCenter(
  face: PlacementFace,
): NormalizedPlacementPoint {
  return placementBasis(face).normal;
}

function localTemplatePoints(
  template: Exclude<PlacementTemplate, "manual">,
): { u: number; v: number }[] {
  if (template === "circle") {
    return Array.from({ length: 36 }, (_, index) => {
      const angle = (index / 36) * Math.PI * 2;
      return { u: Math.cos(angle) * 0.3, v: Math.sin(angle) * 0.3 };
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
    return { u: rawX / 54, v: rawY / 54 + 0.02 };
  });
}

export function pointOnPlacementFace(
  localX: number,
  localY: number,
  face: PlacementFace,
  radius = 1,
): NormalizedPlacementPoint {
  const { east, north, normal } = placementBasis(face);
  const u = clamp(localX, -1, 1) * 0.46;
  const v = clamp(localY, -1, 1) * 0.46;
  const normalScale = Math.sqrt(Math.max(1 - u * u - v * v, 0.1));
  const point = normalize({
    x: normal.x * normalScale + east.x * u + north.x * v,
    y: normal.y * normalScale + east.y * u + north.y * v,
    z: normal.z * normalScale + east.z * u + north.z * v,
  });
  return { x: point.x * radius, y: point.y * radius, z: point.z * radius };
}

export function createPlacementTemplatePoints(
  template: Exclude<PlacementTemplate, "manual">,
  face: PlacementFace,
  radius = 1,
): NormalizedPlacementPoint[] {
  return localTemplatePoints(template).map(({ u, v }) =>
    pointOnPlacementFace(u / 0.46, v / 0.46, face, radius),
  );
}

function rotateAroundY(
  point: NormalizedPlacementPoint,
  degrees: number,
): NormalizedPlacementPoint {
  const angle = (degrees * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
}

export function projectPlacementPoint(
  point: NormalizedPlacementPoint,
  rotationDegrees: number,
): { depth: number; x: number; y: number } {
  const rotated = rotateAroundY(point, rotationDegrees);
  return {
    depth: rotated.z,
    x: 300 + rotated.x * 214,
    y: 272 - rotated.y * 214,
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

function workbenchPoints(
  design: FireworkDesign,
  selectedLayerId: string | undefined,
): WorkbenchPoint[] {
  const result: WorkbenchPoint[] = [];
  design.layers.forEach((layer) => {
    if (!layer.visible) return;
    const selectedLayer = layer.id === selectedLayerId;
    if (layer.kind === "spherical") {
      const generated = generateSphereBurst(
        layer.count,
        1,
        layer.placementSeed,
      );
      const overrides = new Map(
        layer.overrides.map((override) => [override.index, override]),
      );
      const stride = Math.max(1, Math.ceil(layer.count / 180));
      generated.forEach(({ direction }, index) => {
        if (index % stride !== 0 && !overrides.has(index)) return;
        const override = overrides.get(index);
        if (override?.removed) return;
        result.push({
          color: starColor(design, layer, override?.starId),
          editable: selectedLayer && !layer.locked,
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
      return;
    }
    if (layer.kind === "pattern") {
      const stride = Math.max(1, Math.ceil(layer.points.length / 180));
      layer.points.forEach((point, index) => {
        if (index % stride !== 0) return;
        const group = layer.groups.find(
          (candidate) => candidate.id === point.groupId,
        );
        result.push({
          color: starColor(design, layer, group?.starId),
          editable: selectedLayer && !layer.locked,
          index,
          layerId: layer.id,
          point: { x: point.x * 0.88, y: point.y * 0.88, z: layer.depth },
          selectedLayer,
        });
      });
      return;
    }
    const count =
      layer.kind === "child"
        ? layer.count
        : layer.branchCount * Math.min(layer.starsPerBranch, 8);
    generateSphereBurst(Math.min(count, 80), 1, design.assemblySeed).forEach(
      ({ direction }, index) => {
        result.push({
          color: starColor(design, layer),
          editable: false,
          index,
          layerId: layer.id,
          point: {
            x: direction.x * (layer.kind === "child" ? 0.64 : 0.82),
            y: direction.y * (layer.kind === "child" ? 0.64 : 0.82),
            z: direction.z * (layer.kind === "child" ? 0.64 : 0.82),
          },
          selectedLayer,
        });
      },
    );
  });
  return result;
}

function guidePath(
  points: NormalizedPlacementPoint[],
  rotation: number,
): string {
  return points
    .map((point, index) => {
      const projected = projectPlacementPoint(point, rotation);
      return `${index === 0 ? "M" : "L"}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
    })
    .join(" ");
}

function renderGuides(rotation: number): string {
  const latitudes = [-45, 0, 45]
    .map((latitude) => {
      const lat = (latitude * Math.PI) / 180;
      const points = Array.from({ length: 49 }, (_, index) => {
        const longitude = (index / 48) * Math.PI * 2;
        return {
          x: Math.cos(lat) * Math.cos(longitude),
          y: Math.sin(lat),
          z: Math.cos(lat) * Math.sin(longitude),
        };
      });
      return `<path d="${guidePath(points, rotation)}" />`;
    })
    .join("");
  const longitudes = [0, 90, 180, 270]
    .map((longitude) => {
      const lon = (longitude * Math.PI) / 180;
      const points = Array.from({ length: 49 }, (_, index) => {
        const latitude = -Math.PI / 2 + (index / 48) * Math.PI;
        return {
          x: Math.cos(latitude) * Math.cos(lon),
          y: Math.sin(latitude),
          z: Math.cos(latitude) * Math.sin(lon),
        };
      });
      return `<path d="${guidePath(points, rotation)}" />`;
    })
    .join("");
  return latitudes + longitudes;
}

export function renderIntegratedPlacementWorkbench(
  design: FireworkDesign,
  selectedLayer: FireworkLayer | undefined,
  face: PlacementFace,
  placementTemplate: PlacementTemplate,
  selectedPointIndex?: number,
  pointEditingAllowed = true,
): string {
  const safeFace = normalizePlacementFace(face);
  const points = workbenchPoints(design, selectedLayer?.id)
    .map((item) => {
      const projected = projectPlacementPoint(
        item.point,
        safeFace.rotationDegrees,
      );
      const selected =
        pointEditingAllowed &&
        item.selectedLayer &&
        item.index === selectedPointIndex;
      return `<circle
        cx="${projected.x.toFixed(1)}"
        cy="${projected.y.toFixed(1)}"
        r="${selected ? 6.5 : item.selectedLayer ? 4.2 : 2.8}"
        style="--point-color:${colorToCSS(item.color)};--point-depth:${clamp((projected.depth + 1) / 2, 0.25, 1).toFixed(2)}"
        class="workbench-point${item.selectedLayer ? " is-layer-selected" : ""}${selected ? " is-point-selected" : ""}"
        data-layer-id="${item.layerId}"
        data-point-index="${item.index}"
        data-point-editable="${pointEditingAllowed && item.editable}"
      />`;
    })
    .join("");
  const faceCenter = projectPlacementPoint(
    placementFaceCenter(safeFace),
    safeFace.rotationDegrees,
  );
  return `<section class="integrated-workbench" aria-labelledby="placement-workbench-title">
    <header class="workbench-heading">
      <div><p>INTEGRATED PLACEMENT</p><h2 id="placement-workbench-title">玉内配置ワークベンチ</h2></div>
      <span>${selectedLayer ? escapeHTML(selectedLayer.name) : "レイヤーを選択"}</span>
    </header>
    <div class="placement-face-controls">
      <fieldset><legend>緯度区画</legend>${LATITUDE_LABELS.map((label, index) => `<button type="button" data-action="select-latitude" data-index="${index}" class="${safeFace.latitudeBand === index ? "is-active" : ""}" aria-pressed="${safeFace.latitudeBand === index}">${label}</button>`).join("")}</fieldset>
      <fieldset><legend>経度区画</legend>${LONGITUDE_LABELS.map((label, index) => `<button type="button" data-action="select-longitude" data-index="${index}" class="${safeFace.longitudeSector === index ? "is-active" : ""}" aria-pressed="${safeFace.longitudeSector === index}">${label}</button>`).join("")}</fieldset>
    </div>
    <div class="placement-tool-row" aria-label="便利な配置">
      <span>便利な配置</span>
      ${pointEditingAllowed ? (["circle", "heart", "manual"] as PlacementTemplate[]).map((template) => `<button type="button" data-action="placement-template" data-template="${template}" class="${placementTemplate === template ? "is-active" : ""}" aria-pressed="${placementTemplate === template}">${({ circle: "円形", heart: "ハート", manual: "手動" } as const)[template]}</button>`).join("") : '<span class="placement-permission-note">このレイヤーはパラメーターで編集します</span>'}
      ${pointEditingAllowed ? `<button type="button" data-action="delete-point" ${selectedPointIndex === undefined ? "disabled" : ""}>選択点を削除</button>` : ""}
    </div>
    <div class="workbench-canvas-wrap">
      <svg viewBox="0 0 600 544" data-workbench-canvas role="img" aria-label="玉皮、4掛ける4の配置面、全レイヤーの仮想星">
        <defs><radialGradient id="workbench-shell-fill"><stop offset="0" stop-color="#151d24"/><stop offset=".78" stop-color="#0a1117"/><stop offset="1" stop-color="#302416"/></radialGradient></defs>
        <circle cx="300" cy="272" r="224" class="workbench-shell" />
        <g class="workbench-grid">${renderGuides(safeFace.rotationDegrees)}</g>
        <circle cx="${faceCenter.x.toFixed(1)}" cy="${faceCenter.y.toFixed(1)}" r="24" class="workbench-face-marker" />
        <g class="workbench-points">${points}</g>
        <circle cx="300" cy="272" r="224" class="workbench-shell-edge" />
      </svg>
      <p>${pointEditingAllowed ? (placementTemplate === "manual" ? "玉面を押して1点追加。点をドラッグして移動できます。" : "選択区画へ配置後も、各点を手動で編集できます。") : "生成点は参照表示です。右のパラメーターで調整してください。"}</p>
    </div>
  </section>`;
}
