import type { SectionRef } from "../../data";
import { pointFromSection, sliceFrame, stepSection } from "./SliceGeometry";

const CENTER = { x: 92, y: 92 };
const PROJECTION_SCALE = 55;

function project(point: { x: number; y: number; z: number }): {
  x: number;
  y: number;
} {
  return {
    x: CENTER.x + (point.x - point.z * 0.62) * PROJECTION_SCALE,
    y: CENTER.y - (point.y - (point.x + point.z) * 0.18) * PROJECTION_SCALE,
  };
}

function discPath(section: SectionRef): string {
  const points = Array.from({ length: 48 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2;
    return project(
      pointFromSection(section, {
        x: Math.cos(angle),
        y: Math.sin(angle),
      }),
    );
  });
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ")
    .concat(" Z");
}

export function sectionAfterNavigatorDrag(
  section: SectionRef,
  deltaX: number,
  deltaY: number,
): SectionRef {
  const planeSteps =
    Math.abs(deltaX) >= 24 && Math.abs(deltaX) > Math.abs(deltaY) * 0.72
      ? 1
      : 0;
  const ratioSteps = Math.abs(deltaY) >= 20 ? (deltaY < 0 ? 1 : -1) : 0;
  return stepSection(section, planeSteps, ratioSteps);
}

export function renderShellSliceNavigator(section: SectionRef): string {
  const frame = sliceFrame(section);
  const center = project(frame.center);
  const axes = [
    {
      className: "axis-x",
      label: "X",
      point: project({ x: 1.25, y: 0, z: 0 }),
    },
    {
      className: "axis-y",
      label: "Y",
      point: project({ x: 0, y: 1.25, z: 0 }),
    },
    {
      className: "axis-z",
      label: "Z",
      point: project({ x: 0, y: 0, z: 1.25 }),
    },
  ];
  return `<div class="shell-slice-navigator" data-shell-slice-navigator role="application" tabindex="0" aria-label="玉内の切断面を操作">
    <svg viewBox="0 0 184 184" aria-hidden="true">
      <defs>
        <radialGradient id="slice-shell-glow" cx="34%" cy="28%"><stop offset="0" stop-color="#8095a1" stop-opacity=".26"/><stop offset=".72" stop-color="#263740" stop-opacity=".12"/><stop offset="1" stop-color="#090f14" stop-opacity=".48"/></radialGradient>
        <linearGradient id="slice-disc-gold"><stop stop-color="#f0c47e" stop-opacity=".42"/><stop offset="1" stop-color="#93652f" stop-opacity=".16"/></linearGradient>
      </defs>
      <circle cx="92" cy="92" r="58" class="slice-shell" />
      <path d="${discPath(section)}" class="slice-disc" />
      <circle cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" r="2.4" class="slice-center" />
      <g class="slice-gizmo">
        ${axes
          .map(
            (axis) =>
              `<g class="${axis.className}"><line x1="92" y1="92" x2="${axis.point.x.toFixed(2)}" y2="${axis.point.y.toFixed(2)}"/><text x="${axis.point.x.toFixed(2)}" y="${axis.point.y.toFixed(2)}">${axis.label}</text></g>`,
          )
          .join("")}
      </g>
      <circle cx="92" cy="92" r="58" class="slice-shell-edge" />
    </svg>
    <span>ドラッグで回転 · 上下操作で面を送る</span>
  </div>`;
}
