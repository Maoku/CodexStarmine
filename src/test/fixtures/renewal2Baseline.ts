import {
  CHRYSANTHEMUM_PRESET,
  HEART_PRESET,
  SENRIN_PRESET,
  isFireworkDesignV3,
  migrateV2ToV3,
  type FireworkDesignV3,
} from "../../data";

function asFixture(
  source: FireworkDesignV3,
  id: string,
  name: string,
): FireworkDesignV3 {
  const fixture = structuredClone(source);
  fixture.id = id;
  fixture.name = name;
  if (!isFireworkDesignV3(fixture))
    throw new Error(`invalid v3 fixture: ${id}`);
  return fixture;
}

const current = migrateV2ToV3(CHRYSANTHEMUM_PRESET);

export const RENEWAL2_CURRENT_V3_FIXTURE = asFixture(
  current,
  "fixture-renewal2-v3",
  "Renewal2 現行v3",
);

export const RENEWAL2_HEART_PATTERN_FIXTURE = asFixture(
  migrateV2ToV3(HEART_PRESET),
  "fixture-renewal2-heart",
  "Renewal2 ハート型物",
);

const manualOverride = structuredClone(current);
const overrideLayer = manualOverride.layers.find(
  (layer) => layer.kind === "spherical",
);
if (!overrideLayer || overrideLayer.kind !== "spherical") {
  throw new Error("Renewal2 fixture requires a spherical layer");
}
overrideLayer.placement = "manual";
overrideLayer.overrides = [
  {
    index: 0,
    position: { x: 0.25, y: -0.1, z: 0.4 },
    starId: overrideLayer.defaultStarId,
  },
];

export const RENEWAL2_MANUAL_OVERRIDE_FIXTURE = asFixture(
  manualOverride,
  "fixture-renewal2-manual-override",
  "Renewal2 手動override",
);

const core = structuredClone(current);
const coreLayer = core.layers.find((layer) => layer.kind === "spherical");
if (!coreLayer || coreLayer.kind !== "spherical") {
  throw new Error("Renewal2 fixture requires a core-compatible layer");
}
coreLayer.id = "fixture-core-layer";
coreLayer.name = "芯";
coreLayer.radius = 0.55;

export const RENEWAL2_CORE_FIXTURE = asFixture(
  core,
  "fixture-renewal2-core",
  "Renewal2 芯",
);

export const RENEWAL2_CHILD_FIXTURE = asFixture(
  migrateV2ToV3(SENRIN_PRESET),
  "fixture-renewal2-child",
  "Renewal2 子花",
);

export const RENEWAL2_V3_FIXTURES = [
  RENEWAL2_CURRENT_V3_FIXTURE,
  RENEWAL2_HEART_PATTERN_FIXTURE,
  RENEWAL2_MANUAL_OVERRIDE_FIXTURE,
  RENEWAL2_CORE_FIXTURE,
  RENEWAL2_CHILD_FIXTURE,
] as const;
