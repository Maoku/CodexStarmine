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

export interface SliceFrame {
  center: Point3D;
  normal: Point3D;
  radius: number;
  tangentX: Point3D;
  tangentY: Point3D;
}

export function fixedCoordinate(section: SectionRef, sphereRadius = 1): number {
  return (section.ratio * 2 - 1) * sphereRadius;
}

export function sectionRadius(section: SectionRef, sphereRadius = 1): number {
  const fixed = fixedCoordinate(section, sphereRadius);
  return Math.sqrt(Math.max(sphereRadius * sphereRadius - fixed * fixed, 0));
}

export function sliceFrame(section: SectionRef, sphereRadius = 1): SliceFrame {
  const fixed = fixedCoordinate(section, sphereRadius);
  if (section.plane === "xy") {
    return {
      center: { x: 0, y: 0, z: fixed },
      normal: { x: 0, y: 0, z: 1 },
      radius: sectionRadius(section, sphereRadius),
      tangentX: { x: 1, y: 0, z: 0 },
      tangentY: { x: 0, y: 1, z: 0 },
    };
  }
  return {
    center: { x: 0, y: fixed, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    radius: sectionRadius(section, sphereRadius),
    tangentX: { x: 1, y: 0, z: 0 },
    tangentY: { x: 0, y: 0, z: 1 },
  };
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
  const frame = sliceFrame(section, sphereRadius);
  return {
    x:
      frame.center.x +
      local.x * frame.radius * frame.tangentX.x +
      local.y * frame.radius * frame.tangentY.x,
    y:
      frame.center.y +
      local.x * frame.radius * frame.tangentX.y +
      local.y * frame.radius * frame.tangentY.y,
    z:
      frame.center.z +
      local.x * frame.radius * frame.tangentX.z +
      local.y * frame.radius * frame.tangentY.z,
  };
}

export function pointToSection(
  section: SectionRef,
  point: Point3D,
  sphereRadius = 1,
): SectionPoint2D & { distanceFromPlane: number } {
  const frame = sliceFrame(section, sphereRadius);
  const offset = {
    x: point.x - frame.center.x,
    y: point.y - frame.center.y,
    z: point.z - frame.center.z,
  };
  const dot = (a: Point3D, b: Point3D) => a.x * b.x + a.y * b.y + a.z * b.z;
  const radius = frame.radius || 1;
  return {
    distanceFromPlane: Math.abs(dot(offset, frame.normal)),
    x: dot(offset, frame.tangentX) / radius,
    y: dot(offset, frame.tangentY) / radius,
  };
}

export function sameSection(a: SectionRef, b: SectionRef): boolean {
  return a.plane === b.plane && a.ratio === b.ratio;
}

export function stepSection(
  section: SectionRef,
  planeSteps: number,
  ratioSteps: number,
): SectionRef {
  const currentIndex = SECTION_RATIOS.indexOf(section.ratio);
  const nextIndex = Math.min(
    Math.max(currentIndex + Math.sign(ratioSteps), 0),
    SECTION_RATIOS.length - 1,
  );
  return {
    plane:
      Math.abs(planeSteps) % 2 === 0
        ? section.plane
        : section.plane === "xy"
          ? "xz"
          : "xy",
    ratio: SECTION_RATIOS[nextIndex],
  };
}
