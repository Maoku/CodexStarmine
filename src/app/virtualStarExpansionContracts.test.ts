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
  const text = JSON.stringify(value);
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
    expect(FIREWORK_PRESETS.map(({ id }) => id)).toEqual(
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
    const signatures = FIREWORK_PRESETS.map((design) => {
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
        v2: "3fbc2494",
        v3: "94e13a0c",
        v4: "94e13a0c",
      },
      {
        id: "preset-peony",
        v2: "016d8479",
        v3: "e839cdca",
        v4: "e839cdca",
      },
      {
        id: "preset-crown",
        v2: "0d87bf92",
        v3: "f0d5daec",
        v4: "f0d5daec",
      },
      {
        id: "preset-palm",
        v2: "9b7e7906",
        v3: "ece184ce",
        v4: "ece184ce",
      },
      {
        id: "preset-senrin",
        v2: "758bd5e5",
        v3: "0651afed",
        v4: "0651afed",
      },
      {
        id: "preset-heart",
        v2: "238872f8",
        v3: "11e8d39d",
        v4: "3e84fe01",
      },
      {
        id: "preset-willow",
        v2: "80d8a737",
        v3: "ef828761",
        v4: "ef828761",
      },
      {
        id: "preset-bee",
        v2: "b053b793",
        v3: "74186136",
        v4: "74186136",
      },
      {
        id: "preset-hiyusei",
        v2: "f100a40e",
        v3: "6e48bca4",
        v4: "6e48bca4",
      },
      {
        id: "preset-hanarai",
        v2: "7af7b586",
        v3: "380697f1",
        v4: "380697f1",
      },
      {
        id: "preset-kaleidoscope",
        v2: "c08000e1",
        v3: "86c36c33",
        v4: "86c36c33",
      },
      {
        id: "preset-saturn",
        v2: "ebb991c4",
        v3: "f1537539",
        v4: "29538cc4",
      },
      {
        id: "preset-butterfly",
        v2: "bb123d76",
        v3: "3f72cd75",
        v4: "487cae68",
      },
      {
        id: "preset-kowari",
        v2: "bb570d5b",
        v3: "688e9dde",
        v4: "688e9dde",
      },
    ]);
  });
});
