import { describe, expect, it } from "vitest";

import { compileFireworkDesign } from "../core/burst";
import {
  BUILTIN_STAR_PRESETS,
  FIREWORK_PRESETS,
  migrateV2ToV3,
  migrateV3ToV4,
} from "../data";
import { RENEWAL_PREVIEW_RESPONSIBILITIES } from "./renewalContracts";
import {
  VIRTUAL_STAR_EXPANSION_BASELINE_VIEWPORTS,
  VIRTUAL_STAR_EXPANSION_COMPATIBILITY,
  VIRTUAL_STAR_EXPANSION_EXISTING_PRESET_IDS,
  VIRTUAL_STAR_EXPANSION_EXISTING_STAR_IDS,
  VIRTUAL_STAR_EXPANSION_PERFORMANCE_LIMITS,
  VIRTUAL_STAR_EXPANSION_REGRESSION_SEED,
} from "./virtualStarExpansionContracts";

function fingerprint(value: unknown): string {
  // Ignore platform-specific floating-point noise while retaining twelve
  // significant digits in the compile regression contract. Runtime data is unchanged.
  const text = JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === "number" ? Number(entry.toPrecision(12)) : entry,
  );
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

describe("virtual star expansion Phase 0 contracts", () => {
  it("moves only the single-star balloon to the production evaluation path", () => {
    expect(RENEWAL_PREVIEW_RESPONSIBILITIES).toContainEqual({
      input: "single-star",
      kind: "virtual-star-balloon",
      renderer: "star-webgl",
      result: "behavior-sample",
    });
    expect(
      RENEWAL_PREVIEW_RESPONSIBILITIES.find(
        ({ kind }) => kind === "inline-diagnostic",
      ),
    ).toMatchObject({ renderer: "abstract-2d", result: "abstract" });
    expect(
      RENEWAL_PREVIEW_RESPONSIBILITIES.filter(
        ({ result }) => result === "production",
      ).map(({ kind }) => kind),
    ).toEqual(["lake-check", "free-show"]);
  });

  it("freezes the existing eight stars and fourteen firework presets", () => {
    expect(BUILTIN_STAR_PRESETS.slice(0, 8).map(({ id }) => id)).toEqual(
      VIRTUAL_STAR_EXPANSION_EXISTING_STAR_IDS,
    );
    expect(FIREWORK_PRESETS.slice(0, 14).map(({ id }) => id)).toEqual(
      VIRTUAL_STAR_EXPANSION_EXISTING_PRESET_IDS,
    );
  });

  it("records compatibility, load, viewport, and fallback boundaries", () => {
    expect(VIRTUAL_STAR_EXPANSION_COMPATIBILITY).toMatchObject({
      effectFieldsAreOptional: true,
      schemaVersion: 4,
      supportedSourceVersions: [2, 3, 4],
    });
    expect(VIRTUAL_STAR_EXPANSION_PERFORMANCE_LIMITS).toMatchObject({
      maximumParentStars: 48,
      maximumRuntimeParticles: 6_000,
      maximumSecondaryParticles: 192,
      maximumTrailVertices: 4_096,
    });
    expect(VIRTUAL_STAR_EXPANSION_BASELINE_VIEWPORTS).toHaveLength(3);
    expect(
      VIRTUAL_STAR_EXPANSION_BASELINE_VIEWPORTS.every(
        ({ fallbackScreenshot, screenshot }) =>
          fallbackScreenshot.endsWith(".png") && screenshot.endsWith(".png"),
      ),
    ).toBe(true);
  });

  it("pins compact compile fingerprints for v2, v3, and v4 fixtures", () => {
    const signatures = FIREWORK_PRESETS.slice(0, 14).map((design) => {
      const v3 = migrateV2ToV3(design);
      const v4 = migrateV3ToV4(v3);
      return {
        id: design.id,
        v2: fingerprint(
          compileFireworkDesign(design, VIRTUAL_STAR_EXPANSION_REGRESSION_SEED),
        ),
        v3: fingerprint(
          compileFireworkDesign(v3, VIRTUAL_STAR_EXPANSION_REGRESSION_SEED),
        ),
        v4: fingerprint(
          compileFireworkDesign(v4, VIRTUAL_STAR_EXPANSION_REGRESSION_SEED),
        ),
      };
    });

    expect(signatures).toEqual([
      {
        id: "preset-chrysanthemum",
        v2: "b7b3e318",
        v3: "451efe70",
        v4: "451efe70",
      },
      {
        id: "preset-peony",
        v2: "c146ebe5",
        v3: "eba1a547",
        v4: "eba1a547",
      },
      {
        id: "preset-crown",
        v2: "6c4abee9",
        v3: "cf6a14f1",
        v4: "cf6a14f1",
      },
      {
        id: "preset-palm",
        v2: "62276cdb",
        v3: "021d1c9a",
        v4: "021d1c9a",
      },
      {
        id: "preset-senrin",
        v2: "482c0b17",
        v3: "4fc60719",
        v4: "4fc60719",
      },
      {
        id: "preset-heart",
        v2: "a9413a53",
        v3: "d77b23f9",
        v4: "a87def94",
      },
      {
        id: "preset-willow",
        v2: "8ff2740a",
        v3: "103c088d",
        v4: "103c088d",
      },
      {
        id: "preset-bee",
        v2: "4c88cfb5",
        v3: "3e5d7936",
        v4: "3e5d7936",
      },
      {
        id: "preset-hiyusei",
        v2: "03d8ebc8",
        v3: "1d51b497",
        v4: "1d51b497",
      },
      {
        id: "preset-hanarai",
        v2: "7666eaea",
        v3: "f70a5b22",
        v4: "f70a5b22",
      },
      {
        id: "preset-kaleidoscope",
        v2: "db9c4c61",
        v3: "21b6c767",
        v4: "21b6c767",
      },
      {
        id: "preset-saturn",
        v2: "9d56d574",
        v3: "007cc4eb",
        v4: "245d5cd6",
      },
      {
        id: "preset-butterfly",
        v2: "a1356c91",
        v3: "585c0f05",
        v4: "bc39023f",
      },
      {
        id: "preset-kowari",
        v2: "f6ebb5b9",
        v3: "aabc19f3",
        v4: "aabc19f3",
      },
    ]);
  });
});
