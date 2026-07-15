import type { PatternLayerIntent, SectionRef } from "../../data";
import { pointFromSection, type Point3D } from "./SectionGeometry";

export interface PatternRecipe {
  density: number;
  rotationDegrees: number;
  scale: number;
  section: SectionRef;
  template: "circle" | "heart";
}

export interface PatternRecipePoint {
  index: number;
  position: Point3D;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizedTemplatePoint(
  template: PatternRecipe["template"],
  angle: number,
): { x: number; y: number } {
  if (template === "circle") {
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }
  const x = 16 * Math.sin(angle) ** 3;
  const y =
    13 * Math.cos(angle) -
    5 * Math.cos(2 * angle) -
    2 * Math.cos(3 * angle) -
    Math.cos(4 * angle);
  return { x: x / 18, y: y / 18 };
}

export function createPatternRecipePoints(
  recipe: PatternRecipe | PatternLayerIntent["pattern"],
): PatternRecipePoint[] {
  const count = Math.round(clamp(recipe.density, 12, 240));
  const scale = clamp(recipe.scale, 0.15, 0.95);
  const rotation = (recipe.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const source = normalizedTemplatePoint(recipe.template, angle);
    const x = (source.x * cosine - source.y * sine) * scale;
    const y = (source.x * sine + source.y * cosine) * scale;
    return {
      index,
      position: pointFromSection(recipe.section, { x, y }),
    };
  });
}
