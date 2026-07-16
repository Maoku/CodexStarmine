import type { FireworkDesignV4, SectionRef } from "../../data";
import {
  resolveImageStars,
  type ImagePlacementResult,
} from "./ImagePlacementRecipe";
import { pointFromSection } from "./SliceGeometry";

export interface ApplyImagePlacementOptions {
  applyMode: "append" | "replace";
  layerId: string;
  section: SectionRef;
}

export interface ApplyImagePlacementResult {
  appliedPointCount: number;
  createdStarIds: string[];
  status: "applied" | "locked" | "missing-layer" | "wrong-layer-kind";
}

function removeUnusedImageStars(design: FireworkDesignV4): void {
  const referenced = new Set<string>();
  design.layers.forEach((layer) => {
    referenced.add(layer.defaultStarId);
    if (layer.authoringMode === "manual") {
      layer.points.forEach((point) => referenced.add(point.starId));
    } else if (layer.authoringMode === "preset") {
      if (layer.parameters.coloring.mode !== "layer") {
        const alternate = layer.parameters.coloring.alternateStarId;
        if (alternate) referenced.add(alternate);
      }
    }
  });
  Object.keys(design.starDefinitions).forEach((starId) => {
    if (/^star-image-\d+$/.test(starId) && !referenced.has(starId)) {
      delete design.starDefinitions[starId];
    }
  });
}

export function applyImagePlacementToDraft(
  draft: FireworkDesignV4,
  placement: ImagePlacementResult,
  options: ApplyImagePlacementOptions,
): ApplyImagePlacementResult {
  const layer = draft.layers.find(
    (candidate) => candidate.id === options.layerId,
  );
  if (!layer) {
    return {
      appliedPointCount: 0,
      createdStarIds: [],
      status: "missing-layer",
    };
  }
  if (layer.authoringMode !== "manual") {
    return {
      appliedPointCount: 0,
      createdStarIds: [],
      status: "wrong-layer-kind",
    };
  }
  if (layer.locked) {
    return { appliedPointCount: 0, createdStarIds: [], status: "locked" };
  }

  const resolution = resolveImageStars(placement.colors, draft.starDefinitions);
  draft.starDefinitions = resolution.starDefinitions;
  const existingIds = new Set(
    options.applyMode === "append" ? layer.points.map((point) => point.id) : [],
  );
  let pointNumber = 1;
  const generated = placement.points.map((point, index) => {
    while (existingIds.has(`${layer.id}-image-${pointNumber}`))
      pointNumber += 1;
    const id = `${layer.id}-image-${pointNumber}`;
    existingIds.add(id);
    pointNumber += 1;
    return {
      id,
      position: pointFromSection(options.section, point),
      section: { ...options.section },
      starId: resolution.starIds[index] ?? layer.defaultStarId,
    };
  });
  layer.points =
    options.applyMode === "append"
      ? [...layer.points, ...generated]
      : generated;
  removeUnusedImageStars(draft);
  return {
    appliedPointCount: generated.length,
    createdStarIds: resolution.createdStarIds.filter(
      (starId) => draft.starDefinitions[starId],
    ),
    status: "applied",
  };
}
