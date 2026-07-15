import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { compileFireworkDesign, type CompiledBurstPlan } from "../core/burst";
import {
  DesignRepository,
  FIREWORK_DESIGN_V2_SCHEMA_VERSION,
  FIREWORK_PRESETS,
  isFireworkDesignV2,
  isFireworkDesignV3,
  restoreLegacyV2Design,
  STORAGE_KEY_V2,
  STORAGE_KEY_V3,
  type FireworkDesign,
  type StorageLike,
  type StoredLibraryV2,
  type StoredLibraryV3,
} from "../data";
import { generateFreeShow } from "../modes/viewFree";
import {
  FREE_SHOW_BASELINE_HASH,
  PRESET_BASELINES,
  RENEWAL_BASELINE_SEED,
  RENEWAL_FREE_SHOW_SEED,
  SAVED_DESIGN_V2_FIXTURE,
  SAVED_DESIGN_V2_HASH,
  SAVED_DESIGN_V2_PLAN_HASH,
  type PresetBaseline,
} from "./fixtures/renewalBaseline";

function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSON).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash("sha256").update(canonicalJSON(value)).digest("hex");
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function baselineFor(
  design: FireworkDesign,
  plan: CompiledBurstPlan,
): PresetBaseline {
  return {
    assemblySeed: design.assemblySeed,
    boundsRadius: round(plan.bounds.radius),
    childBurstCount: plan.estimatedCost.childBurstCount,
    designHash: hash(design),
    id: design.id,
    maximumParticles: plan.estimatedCost.maximumParticles,
    planHash: hash(plan),
    starCount: plan.estimatedCost.starCount,
  };
}

function memoryStorage(): {
  storage: StorageLike;
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    values,
  };
}

describe("Renewal Phase 0 baselines", () => {
  it("locks all six presets and their fixed-seed compiled launch plans", () => {
    const actual = FIREWORK_PRESETS.map((design) =>
      baselineFor(design, compileFireworkDesign(design, RENEWAL_BASELINE_SEED)),
    );

    expect(actual).toEqual(PRESET_BASELINES);
  });

  it("migrates the saved v2 fixture without changing its legacy envelope", () => {
    const { storage, values } = memoryStorage();
    const rawV2 = JSON.stringify({
      version: FIREWORK_DESIGN_V2_SCHEMA_VERSION,
      designs: [SAVED_DESIGN_V2_FIXTURE],
    } satisfies StoredLibraryV2);
    values.set(STORAGE_KEY_V2, rawV2);
    const migrated = new DesignRepository(
      storage,
      () => "renewal-baseline",
    ).list()[0];
    const restored = restoreLegacyV2Design(migrated);
    const rawV3 = values.get(STORAGE_KEY_V3);

    expect(hash(SAVED_DESIGN_V2_FIXTURE)).toBe(SAVED_DESIGN_V2_HASH);
    expect(
      hash(
        compileFireworkDesign(SAVED_DESIGN_V2_FIXTURE, RENEWAL_BASELINE_SEED),
      ),
    ).toBe(SAVED_DESIGN_V2_PLAN_HASH);
    expect(values.get(STORAGE_KEY_V2)).toBe(rawV2);
    expect(restored).toEqual(SAVED_DESIGN_V2_FIXTURE);
    expect(restored && isFireworkDesignV2(restored)).toBe(true);
    expect(rawV3).toBeDefined();

    const envelope = JSON.parse(rawV3 ?? "") as StoredLibraryV3;
    expect(envelope.version).toBe(3);
    expect(envelope.designs.every(isFireworkDesignV3)).toBe(true);
    expect(new DesignRepository(storage).list()).toEqual([migrated]);
  });

  it("locks the fixed-seed free-view show using presets and the saved work", () => {
    const plan = generateFreeShow(
      [...FIREWORK_PRESETS, SAVED_DESIGN_V2_FIXTURE],
      1,
      RENEWAL_FREE_SHOW_SEED,
    );

    expect(
      plan.cues.some(
        ({ fireworkDesignID }) =>
          fireworkDesignID === SAVED_DESIGN_V2_FIXTURE.id,
      ),
    ).toBe(true);
    expect(hash(plan)).toBe(FREE_SHOW_BASELINE_HASH);
  });
});
