import type { SectionRef, SectionRatio } from "../../data";

export const SECTION_RATIOS: readonly SectionRatio[] = [
  0.1, 0.3, 0.5, 0.7, 0.9,
];

export interface SectionPoint2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function fixedCoordinate(section: SectionRef, sphereRadius = 1): number {
  return (section.ratio * 2 - 1) * sphereRadius;
}

export function sectionRadius(section: SectionRef, sphereRadius = 1): number {
  const fixed = fixedCoordinate(section, sphereRadius);
  return Math.sqrt(Math.max(sphereRadius * sphereRadius - fixed * fixed, 0));
}

export function clampSectionPoint(point: SectionPoint2D): SectionPoint2D {
  const length = Math.hypot(point.x, point.y);
  if (length <= 1) return { ...point };
  return { x: point.x / length, y: point.y / length };
}

export function pointFromSection(
  section: SectionRef,
  point: SectionPoint2D,
  sphereRadius = 1,
): Point3D {
  const local = clampSectionPoint(point);
  const radius = sectionRadius(section, sphereRadius);
  const fixed = fixedCoordinate(section, sphereRadius);
  if (section.plane === "xy") {
    return { x: local.x * radius, y: local.y * radius, z: fixed };
  }
  return { x: local.x * radius, y: fixed, z: local.y * radius };
}

export function pointToSection(
  section: SectionRef,
  point: Point3D,
  sphereRadius = 1,
): SectionPoint2D & { distanceFromPlane: number } {
  const radius = sectionRadius(section, sphereRadius) || 1;
  const fixed = fixedCoordinate(section, sphereRadius);
  return section.plane === "xy"
    ? {
        distanceFromPlane: Math.abs(point.z - fixed),
        x: point.x / radius,
        y: point.y / radius,
      }
    : {
        distanceFromPlane: Math.abs(point.y - fixed),
        x: point.x / radius,
        y: point.z / radius,
      };
}

export function sameSection(a: SectionRef, b: SectionRef): boolean {
  return a.plane === b.plane && a.ratio === b.ratio;
}

export function sectionLabel(section: SectionRef): string {
  return `${section.plane.toUpperCase()} ${Math.round(section.ratio * 100)}%`;
}
