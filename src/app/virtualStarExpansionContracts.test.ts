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
  // Ignore platform-specific floating-point noise, including near-zero trig
  // results, at 1e-9 precision. Only regression fingerprints are normalized.
  const text = JSON.stringify(value, (_key, entry: unknown) =>
    typeof entry === "number" ? Number(entry.toFixed(9)) : entry,
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
        v2: "6ed630b6",
        v3: "a4995163",
        v4: "a4995163",
      },
      {
        id: "preset-peony",
        v2: "7c05d27d",
        v3: "46117376",
        v4: "46117376",
      },
      {
        id: "preset-crown",
        v2: "1e6041f3",
        v3: "30dd84ec",
        v4: "30dd84ec",
      },
      {
        id: "preset-palm",
        v2: "c863f650",
        v3: "9e6acc03",
        v4: "9e6acc03",
      },
      {
        id: "preset-senrin",
        v2: "171b29bf",
        v3: "84083b45",
        v4: "84083b45",
      },
      {
        id: "preset-heart",
        v2: "48bbd79c",
        v3: "102cd3f7",
        v4: "fa34923d",
      },
      {
        id: "preset-willow",
        v2: "d3413e58",
        v3: "828f279a",
        v4: "828f279a",
      },
      {
        id: "preset-bee",
        v2: "bf7b884e",
        v3: "33221c3d",
        v4: "33221c3d",
      },
      {
        id: "preset-hiyusei",
        v2: "25a6488e",
        v3: "fb1169dd",
        v4: "fb1169dd",
      },
      {
        id: "preset-hanarai",
        v2: "ac3f3477",
        v3: "e25d82df",
        v4: "e25d82df",
      },
      {
        id: "preset-kaleidoscope",
        v2: "333afe26",
        v3: "b3a6c431",
        v4: "b3a6c431",
      },
      {
        id: "preset-saturn",
        v2: "cd13394b",
        v3: "870690fa",
        v4: "67049f5e",
      },
      {
        id: "preset-butterfly",
        v2: "0fc3e495",
        v3: "b26a9107",
        v4: "b9120948",
      },
      {
        id: "preset-kowari",
        v2: "7e578328",
        v3: "9b12cd8b",
        v4: "9b12cd8b",
      },
    ]);
  });
});
