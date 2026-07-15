import {
  CURRENT_DERIVATION_VERSION,
  FIREWORK_DESIGN_V2_SCHEMA_VERSION,
  FIREWORK_DESIGN_V3_SCHEMA_VERSION,
  type FireworkDesign,
  type FireworkDesignV2,
  type FireworkDesignV3,
  type LegacyBehaviorSnapshot,
  type LegacyLayerBehavior,
} from "../firework";

export const V2_TO_V3_REGRESSION_SEED = 424_242;

function snapshotLayerBehavior(
  layer: FireworkDesignV2["layers"][number],
): LegacyLayerBehavior {
  const base: LegacyLayerBehavior = {
    id: layer.id,
    ignitionOffset: layer.ignitionOffset,
    radialSpeedScale: layer.radialSpeedScale,
  };
  if (layer.kind === "pattern") {
    base.allowedAngle = layer.allowedAngle;
    base.orientationDegrees = layer.orientationDegrees;
    base.rotationJitter = layer.rotationJitter;
  } else if (layer.kind === "child") {
    base.delay = layer.delay;
    base.waveDelay = layer.waveDelay;
  }
  return base;
}

export function createLegacyBehaviorSnapshot(
  design: FireworkDesignV2,
): LegacyBehaviorSnapshot {
  return {
    burstField: structuredClone(design.burstField),
    launchVariation: structuredClone(design.launchVariation),
    layers: design.layers.map(snapshotLayerBehavior),
    realism: structuredClone(design.realism),
    sourceSchemaVersion: FIREWORK_DESIGN_V2_SCHEMA_VERSION,
  };
}

export function migrateV2ToV3(design: FireworkDesignV2): FireworkDesignV3 {
  return {
    ...structuredClone(design),
    derivationVersion: CURRENT_DERIVATION_VERSION,
    legacyBehavior: createLegacyBehaviorSnapshot(design),
    schemaVersion: FIREWORK_DESIGN_V3_SCHEMA_VERSION,
  };
}

export function ensureFireworkDesignV3(
  design: FireworkDesign,
): FireworkDesignV3 {
  return design.schemaVersion === FIREWORK_DESIGN_V3_SCHEMA_VERSION
    ? structuredClone(design)
    : migrateV2ToV3(design);
}

/** Reconstructs the read-only v2 comparison input without modifying v2 data. */
export function restoreLegacyV2Design(
  design: FireworkDesignV3,
): FireworkDesignV2 | undefined {
  const snapshot = design.legacyBehavior;
  if (!snapshot) return undefined;
  const restored = structuredClone(design) as unknown as FireworkDesignV2 & {
    derivationVersion?: number;
    legacyBehavior?: LegacyBehaviorSnapshot;
  };
  restored.schemaVersion = FIREWORK_DESIGN_V2_SCHEMA_VERSION;
  delete restored.derivationVersion;
  delete restored.legacyBehavior;
  restored.burstField = structuredClone(snapshot.burstField);
  restored.launchVariation = structuredClone(snapshot.launchVariation);
  restored.realism = structuredClone(snapshot.realism);
  const layers = new Map(snapshot.layers.map((layer) => [layer.id, layer]));
  restored.layers.forEach((layer) => {
    const source = layers.get(layer.id);
    if (!source) return;
    layer.ignitionOffset = source.ignitionOffset;
    layer.radialSpeedScale = source.radialSpeedScale;
    if (layer.kind === "pattern") {
      if (source.allowedAngle !== undefined)
        layer.allowedAngle = source.allowedAngle;
      if (source.orientationDegrees !== undefined)
        layer.orientationDegrees = source.orientationDegrees;
      if (source.rotationJitter !== undefined)
        layer.rotationJitter = source.rotationJitter;
    } else if (layer.kind === "child") {
      if (source.delay !== undefined) layer.delay = source.delay;
      if (source.waveDelay !== undefined) layer.waveDelay = source.waveDelay;
    }
  });
  return restored;
}
