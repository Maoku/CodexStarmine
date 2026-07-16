import type { SectionPoint2D } from "./SliceGeometry";

export type ManualPlacementKind = "circle" | "line" | "arc" | "grid";

export interface ManualPlacementSettings {
  angleDegrees: number;
  columns: number;
  count: number;
  endAngleDegrees: number;
  length: number;
  radius: number;
  rotationDegrees: number;
  rows: number;
  spacing: number;
  startAngleDegrees: number;
}

export const DEFAULT_MANUAL_PLACEMENT_SETTINGS: ManualPlacementSettings = {
  angleDegrees: 0,
  columns: 5,
  count: 24,
  endAngleDegrees: 135,
  length: 1.4,
  radius: 0.72,
  rotationDegrees: 0,
  rows: 5,
  spacing: 0.26,
  startAngleDegrees: -135,
};

const SAFETY_RADIUS = 0.94;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function rotate(point: SectionPoint2D, degrees: number): SectionPoint2D {
  const angle = (degrees * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

export function createManualPlacementPoints(
  kind: ManualPlacementKind,
  settings: ManualPlacementSettings,
): SectionPoint2D[] {
  const count = Math.round(
    clamp(settings.count, kind === "circle" ? 3 : 2, 240),
  );
  const radius = clamp(settings.radius, 0.05, SAFETY_RADIUS);
  if (kind === "circle") {
    return Array.from({ length: count }, (_, index) => {
      const angle =
        (settings.rotationDegrees * Math.PI) / 180 +
        (index / count) * Math.PI * 2;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }
  if (kind === "line") {
    const length = clamp(settings.length, 0.1, SAFETY_RADIUS * 2);
    return Array.from({ length: count }, (_, index) => {
      const progress = count === 1 ? 0.5 : index / (count - 1);
      return rotate(
        { x: (progress - 0.5) * length, y: 0 },
        settings.angleDegrees,
      );
    });
  }
  if (kind === "arc") {
    const start = (settings.startAngleDegrees * Math.PI) / 180;
    const end = (settings.endAngleDegrees * Math.PI) / 180;
    return Array.from({ length: count }, (_, index) => {
      const progress = count === 1 ? 0.5 : index / (count - 1);
      const angle = start + (end - start) * progress;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }

  const rows = Math.round(clamp(settings.rows, 1, 20));
  const columns = Math.round(clamp(settings.columns, 1, 20));
  const spacing = clamp(settings.spacing, 0.04, 0.45);
  const points: SectionPoint2D[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = rotate(
        {
          x: (column - (columns - 1) / 2) * spacing,
          y: ((rows - 1) / 2 - row) * spacing,
        },
        settings.rotationDegrees,
      );
      if (Math.hypot(point.x, point.y) <= SAFETY_RADIUS + 1e-10) {
        points.push(point);
      }
    }
  }
  return points;
}
