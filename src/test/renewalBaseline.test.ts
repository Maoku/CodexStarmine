import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { compileFireworkDesign, type CompiledBurstPlan } from "../core/burst";
import {
  DesignRepository,
  FIREWORK_DESIGN_V2_SCHEMA_VERSION,
  FIREWORK_PRESETS,
  isFireworkDesignV2,
  STORAGE_KEY_V2,
  type FireworkDesign,
  type StorageLike,
  type StoredLibraryV2,
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

  it("round-trips the saved v2 fixture without changing the legacy envelope", () => {
    const { storage, values } = memoryStorage();
    const repository = new DesignRepository(storage, () => "renewal-baseline");
    const saved = repository.save(SAVED_DESIGN_V2_FIXTURE);
    const raw = values.get(STORAGE_KEY_V2);

    expect(saved).toEqual(SAVED_DESIGN_V2_FIXTURE);
    expect(hash(saved)).toBe(SAVED_DESIGN_V2_HASH);
    expect(
      hash(compileFireworkDesign(saved, RENEWAL_BASELINE_SEED)),
    ).toBe(SAVED_DESIGN_V2_PLAN_HASH);
    expect(raw).toBeDefined();

    const envelope = JSON.parse(raw ?? "") as StoredLibraryV2;
    expect(envelope.version).toBe(FIREWORK_DESIGN_V2_SCHEMA_VERSION);
    expect(envelope.designs).toEqual([SAVED_DESIGN_V2_FIXTURE]);
    expect(envelope.designs.every(isFireworkDesignV2)).toBe(true);
    expect(new DesignRepository(storage).list()).toEqual([
      SAVED_DESIGN_V2_FIXTURE,
    ]);
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
