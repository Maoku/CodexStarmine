import type {
  FireworkDesign,
  FireworkDesignV4,
  FireworkLayer,
  LayerIntentV4,
} from "../../data";

export function colorToCSS(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function layerColor(
  design: FireworkDesign,
  layer: FireworkLayer,
): string {
  const definition = design.starDefinitions[layer.defaultStarId];
  return colorToCSS(
    definition?.colorStages[1]?.color ??
      definition?.colorStages[0]?.color ??
      0xd9d4c9,
  );
}

export function layerKindLabel(layer: FireworkLayer): string {
  if (layer.kind === "spherical") return "球面";
  if (layer.kind === "pattern") return "型物";
  if (layer.kind === "branch") return "枝状";
  return "子花";
}

export function intentLayerColor(
  design: FireworkDesignV4,
  layer: LayerIntentV4,
): string {
  const definition = design.starDefinitions[layer.defaultStarId];
  return colorToCSS(
    definition?.colorStages[1]?.color ??
      definition?.colorStages[0]?.color ??
      0xd9d4c9,
  );
}

export function layerAuthoringLabel(layer: LayerIntentV4): string {
  if (layer.authoringMode === "preset") return "既定";
  if (layer.authoringMode === "pattern") return "型物";
  return "手動";
}
