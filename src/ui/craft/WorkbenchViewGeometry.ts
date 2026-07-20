import type { SectionRef } from "../../data";
import {
  pointFromSection,
  sliceFrame,
  type Point3D,
  type SectionPoint2D,
} from "./SliceGeometry";

export interface WorkbenchViewState {
  pitchDegrees: number;
  yawDegrees: number;
  zoom: number;
}

export interface WorkbenchViewport {
  centerX: number;
  centerY: number;
  radius: number;
}

export interface WorkbenchProjectedPoint {
  depth: number;
  visualScale: number;
  x: number;
  y: number;
}

export const DEFAULT_WORKBENCH_VIEW_STATE: Readonly<WorkbenchViewState> = {
  pitchDegrees: 0,
  yawDegrees: 0,
  zoom: 1,
};

export const DEFAULT_WORKBENCH_VIEWPORT: Readonly<WorkbenchViewport> = {
  centerX: 300,
  centerY: 272,
  radius: 214,
};

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function dot(left: Point3D, right: Point3D): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function add(left: Point3D, right: Point3D, scale = 1): Point3D {
  return {
    x: left.x + right.x * scale,
    y: left.y + right.y * scale,
    z: left.z + right.z * scale,
  };
}

export function normalizeWorkbenchViewState(
  state: WorkbenchViewState,
): WorkbenchViewState {
  return {
    pitchDegrees: clamp(finiteOr(state.pitchDegrees, 0), -60, 60),
    yawDegrees: clamp(finiteOr(state.yawDegrees, 0), -180, 180),
    zoom: clamp(finiteOr(state.zoom, 1), 0.5, 2),
  };
}

/** Rotate world coordinates into the editor camera coordinate system. */
export function rotatePointForWorkbenchView(
  point: Point3D,
  viewState: WorkbenchViewState,
): Point3D {
  const state = normalizeWorkbenchViewState(viewState);
  const yaw = radians(state.yawDegrees);
  const pitch = radians(state.pitchDegrees);
  const yawCosine = Math.cos(yaw);
  const yawSine = Math.sin(yaw);
  const pitchCosine = Math.cos(pitch);
  const pitchSine = Math.sin(pitch);
  const yawed = {
    x: point.x * yawCosine + point.z * yawSine,
    y: point.y,
    z: -point.x * yawSine + point.z * yawCosine,
  };
  return {
    x: yawed.x,
    y: yawed.y * pitchCosine - yawed.z * pitchSine,
    z: yawed.y * pitchSine + yawed.z * pitchCosine,
  };
}

/** Inverse of rotatePointForWorkbenchView. */
export function unrotatePointFromWorkbenchView(
  point: Point3D,
  viewState: WorkbenchViewState,
): Point3D {
  const state = normalizeWorkbenchViewState(viewState);
  const yaw = radians(state.yawDegrees);
  const pitch = radians(state.pitchDegrees);
  const yawCosine = Math.cos(yaw);
  const yawSine = Math.sin(yaw);
  const pitchCosine = Math.cos(pitch);
  const pitchSine = Math.sin(pitch);
  const pitched = {
    x: point.x,
    y: point.y * pitchCosine + point.z * pitchSine,
    z: -point.y * pitchSine + point.z * pitchCosine,
  };
  return {
    x: pitched.x * yawCosine - pitched.z * yawSine,
    y: pitched.y,
    z: pitched.x * yawSine + pitched.z * yawCosine,
  };
}

export function projectWorkbenchPoint(
  point: Point3D,
  viewState: WorkbenchViewState,
  viewport: WorkbenchViewport = DEFAULT_WORKBENCH_VIEWPORT,
): WorkbenchProjectedPoint {
  const state = normalizeWorkbenchViewState(viewState);
  const rotated = rotatePointForWorkbenchView(point, state);
  const scale = viewport.radius * state.zoom;
  return {
    depth: rotated.z,
    visualScale: 1 + clamp(rotated.z, -1, 1) * 0.14,
    x: viewport.centerX + rotated.x * scale,
    y: viewport.centerY - rotated.y * scale,
  };
}

/**
 * Orthographic screen ray intersected with the selected world-space section.
 * Returns undefined while the selected plane is effectively edge-on.
 */
export function unprojectWorkbenchPointToSection(
  screenPoint: { x: number; y: number },
  section: SectionRef,
  viewState: WorkbenchViewState,
  viewport: WorkbenchViewport = DEFAULT_WORKBENCH_VIEWPORT,
): Point3D | undefined {
  const state = normalizeWorkbenchViewState(viewState);
  const scale = viewport.radius * state.zoom;
  const rayOrigin = unrotatePointFromWorkbenchView(
    {
      x: (screenPoint.x - viewport.centerX) / scale,
      y: (viewport.centerY - screenPoint.y) / scale,
      z: 0,
    },
    state,
  );
  const rayDirection = unrotatePointFromWorkbenchView(
    { x: 0, y: 0, z: 1 },
    state,
  );
  const frame = sliceFrame(section);
  const denominator = dot(rayDirection, frame.normal);
  if (Math.abs(denominator) < 1e-6) return undefined;
  const originToPlane = {
    x: frame.center.x - rayOrigin.x,
    y: frame.center.y - rayOrigin.y,
    z: frame.center.z - rayOrigin.z,
  };
  return add(
    rayOrigin,
    rayDirection,
    dot(originToPlane, frame.normal) / denominator,
  );
}

export function projectWorkbenchSectionOutline(
  section: SectionRef,
  viewState: WorkbenchViewState,
  viewport: WorkbenchViewport = DEFAULT_WORKBENCH_VIEWPORT,
  segmentCount = 64,
): WorkbenchProjectedPoint[] {
  const count = Math.max(8, Math.round(finiteOr(segmentCount, 64)));
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return projectWorkbenchPoint(
      pointFromSection(section, {
        x: Math.cos(angle),
        y: Math.sin(angle),
      }),
      viewState,
      viewport,
    );
  });
}

export function clampPointToSectionDisc(
  point: Point3D,
  section: SectionRef,
): Point3D {
  const frame = sliceFrame(section);
  const offset = {
    x: point.x - frame.center.x,
    y: point.y - frame.center.y,
    z: point.z - frame.center.z,
  };
  const local: SectionPoint2D = {
    x:
      (offset.x * frame.tangentX.x +
        offset.y * frame.tangentX.y +
        offset.z * frame.tangentX.z) /
      (frame.radius || 1),
    y:
      (offset.x * frame.tangentY.x +
        offset.y * frame.tangentY.y +
        offset.z * frame.tangentY.z) /
      (frame.radius || 1),
  };
  const length = Math.hypot(local.x, local.y);
  const safe =
    length > 1 ? { x: local.x / length, y: local.y / length } : local;
  return pointFromSection(section, safe);
}

export function stableDepthSort<T>(
  values: readonly T[],
  depthFor: (value: T) => number,
): T[] {
  return values
    .map((value, index) => ({
      depth: finiteOr(depthFor(value), 0),
      index,
      value,
    }))
    .sort((left, right) => left.depth - right.depth || left.index - right.index)
    .map(({ value }) => value);
}
