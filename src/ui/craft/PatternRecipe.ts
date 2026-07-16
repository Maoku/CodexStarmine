import type {
  PatternLayerIntent,
  PatternTemplate,
  SectionRef,
} from "../../data";
import {
  pointFromSection,
  sliceFrame,
  type Point3D,
  type SectionPoint2D,
} from "./SliceGeometry";

export interface PatternRecipe {
  density: number;
  rotationDegrees: number;
  scale: number;
  section: SectionRef;
  template: PatternTemplate;
}

export interface PatternRecipePoint {
  index: number;
  position: Point3D;
}

export const PATTERN_TEMPLATES = [
  "circle",
  "heart",
  "star",
  "square",
  "triangle",
  "hexagon",
] as const satisfies readonly PatternTemplate[];

export const PATTERN_TEMPLATE_LABELS: Record<PatternTemplate, string> = {
  circle: "円形",
  heart: "ハート",
  star: "星形",
  square: "四角",
  triangle: "三角",
  hexagon: "六角形",
};

const SLICE_SAFETY_RATIO = 0.94;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function regularVertices(
  sides: number,
  innerRadius?: number,
): SectionPoint2D[] {
  const count = innerRadius === undefined ? sides : sides * 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const radius =
      innerRadius !== undefined && index % 2 === 1 ? innerRadius : 1;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

export function patternTemplateVertices(
  template: PatternTemplate,
): readonly SectionPoint2D[] {
  if (template === "star") return regularVertices(5, 0.44);
  if (template === "square") return regularVertices(4);
  if (template === "triangle") return regularVertices(3);
  if (template === "hexagon") return regularVertices(6);
  return [];
}

function createNormalizedHeartSamples(): SectionPoint2D[] {
  const samples = Array.from({ length: 2_048 }, (_, index) => {
    const angle = (index / 2_048) * Math.PI * 2;
    return {
      x: 16 * Math.sin(angle) ** 3,
      y:
        13 * Math.cos(angle) -
        5 * Math.cos(2 * angle) -
        2 * Math.cos(3 * angle) -
        Math.cos(4 * angle),
    };
  });
  const outerRadius = Math.max(
    ...samples.map((point) => Math.hypot(point.x, point.y)),
  );
  return samples.map((point) => ({
    x: point.x / outerRadius,
    y: point.y / outerRadius,
  }));
}

const NORMALIZED_HEART_SAMPLES = createNormalizedHeartSamples();

function resampleClosedCurve(
  source: readonly SectionPoint2D[],
  count: number,
): SectionPoint2D[] {
  const lengths: number[] = [0];
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[(index + 1) % source.length];
    lengths.push(
      lengths[index] + Math.hypot(next.x - current.x, next.y - current.y),
    );
  }
  const perimeter = lengths[lengths.length - 1];
  let segment = 0;
  return Array.from({ length: count }, (_, index) => {
    const distance = (index / count) * perimeter;
    while (segment + 1 < lengths.length && lengths[segment + 1] < distance) {
      segment += 1;
    }
    const current = source[segment % source.length];
    const next = source[(segment + 1) % source.length];
    const segmentLength = lengths[segment + 1] - lengths[segment] || 1;
    const progress = (distance - lengths[segment]) / segmentLength;
    return {
      x: current.x + (next.x - current.x) * progress,
      y: current.y + (next.y - current.y) * progress,
    };
  });
}

function samplePolygonWithVertices(
  vertices: readonly SectionPoint2D[],
  count: number,
): SectionPoint2D[] {
  const baseSegments = Math.floor(count / vertices.length);
  const remainder = count % vertices.length;
  return vertices.flatMap((current, edge) => {
    const next = vertices[(edge + 1) % vertices.length];
    const segments = baseSegments + (edge < remainder ? 1 : 0);
    return Array.from({ length: segments }, (_, index) => {
      const progress = index / segments;
      return {
        x: current.x + (next.x - current.x) * progress,
        y: current.y + (next.y - current.y) * progress,
      };
    });
  });
}

export function createNormalizedTemplatePoints(
  template: PatternTemplate,
  requestedCount: number,
): SectionPoint2D[] {
  const count = Math.round(clamp(requestedCount, 12, 240));
  if (template === "circle") {
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      return { x: Math.cos(angle), y: Math.sin(angle) };
    });
  }
  if (template === "heart") {
    return resampleClosedCurve(NORMALIZED_HEART_SAMPLES, count);
  }
  return samplePolygonWithVertices(patternTemplateVertices(template), count);
}

export function patternTemplateOuterRadius(template: PatternTemplate): number {
  const featurePoints =
    template === "heart"
      ? NORMALIZED_HEART_SAMPLES
      : patternTemplateVertices(template).length > 0
        ? patternTemplateVertices(template)
        : createNormalizedTemplatePoints(template, 24);
  return Math.max(
    ...featurePoints.map((point) => Math.hypot(point.x, point.y)),
  );
}

export function patternScaleLimit(
  section: SectionRef,
  template: PatternTemplate,
): number {
  const sliceRadius = sliceFrame(section).radius;
  const templateOuterRadius = patternTemplateOuterRadius(template);
  if (sliceRadius <= 1e-6 || templateOuterRadius <= 1e-6) return 0.15;
  return clamp(
    (sliceRadius * SLICE_SAFETY_RATIO) / (templateOuterRadius * sliceRadius),
    0.15,
    1,
  );
}

export function effectivePatternScale(
  recipe: PatternRecipe | PatternLayerIntent["pattern"],
): number {
  return clamp(
    recipe.scale,
    0.15,
    patternScaleLimit(recipe.section, recipe.template),
  );
}

export function createPatternRecipePoints(
  recipe: PatternRecipe | PatternLayerIntent["pattern"],
): PatternRecipePoint[] {
  const count = Math.round(clamp(recipe.density, 12, 240));
  const scale = effectivePatternScale(recipe);
  const rotation = (recipe.rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return createNormalizedTemplatePoints(recipe.template, count).map(
    (source, index) => {
      const x = (source.x * cosine - source.y * sine) * scale;
      const y = (source.x * sine + source.y * cosine) * scale;
      return {
        index,
        position: pointFromSection(recipe.section, { x, y }),
      };
    },
  );
}
