import { describe, expect, it } from "vitest";

import {
  RENEWAL2_ACCEPTANCE_CONTRACTS,
  RENEWAL2_BACKGROUND_RUNTIME_BY_SCREEN,
  RENEWAL2_LAYER_EDITING_PERMISSIONS,
  RENEWAL_PREVIEW_RESPONSIBILITIES,
  RENEWAL_SCREEN_COMPONENTS,
  RENEWAL_SCREEN_TRANSITIONS,
  type RenewalScreenKind,
} from "./renewalContracts";

describe("renewal acceptance contracts", () => {
  it("fixes five screen components and context-specific viewer routes", () => {
    const screenKinds = new Set<RenewalScreenKind>();
    RENEWAL_SCREEN_TRANSITIONS.forEach(({ from, to }) => {
      screenKinds.add(from);
      screenKinds.add(to);
    });

    expect(screenKinds).toEqual(
      new Set([
        "mode-select",
        "library",
        "initial-setup",
        "editor",
        "viewer-check",
        "viewer-free",
      ]),
    );
    expect(RENEWAL_SCREEN_COMPONENTS).toHaveLength(5);
    expect(
      RENEWAL_SCREEN_TRANSITIONS.find(
        ({ action }) => action === "back-to-editor",
      ),
    ).toMatchObject({ from: "viewer-check", to: "editor" });
    expect(
      RENEWAL_SCREEN_TRANSITIONS.filter(
        ({ action }) => action === "back-to-mode-select",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "library", to: "mode-select" }),
        expect.objectContaining({
          from: "viewer-free",
          to: "mode-select",
        }),
      ]),
    );
    expect(
      RENEWAL_SCREEN_TRANSITIONS.find(
        ({ action }) => action === "back-to-library",
      ),
    ).toMatchObject({ dirtyGuard: true, from: "editor", to: "library" });
  });

  it("keeps aggregate previews independent from production rendering", () => {
    const abstractPreviews = RENEWAL_PREVIEW_RESPONSIBILITIES.filter(
      ({ result }) => result === "abstract",
    );
    const behaviorSamples = RENEWAL_PREVIEW_RESPONSIBILITIES.filter(
      ({ result }) => result === "behavior-sample",
    );
    const productionPreviews = RENEWAL_PREVIEW_RESPONSIBILITIES.filter(
      ({ result }) => result === "production",
    );

    expect(
      abstractPreviews.every(({ renderer }) => renderer === "abstract-2d"),
    ).toBe(true);
    expect(behaviorSamples).toEqual([
      expect.objectContaining({
        input: "single-star",
        kind: "virtual-star-balloon",
        renderer: "star-webgl",
      }),
    ]);
    expect(
      productionPreviews.every(
        ({ renderer }) => renderer === "firework-system",
      ),
    ).toBe(true);
    expect(productionPreviews.map(({ kind }) => kind)).toEqual([
      "lake-check",
      "free-show",
    ]);
  });

  it("tracks every Renewal2 requirement with a phase and evidence", () => {
    expect(RENEWAL2_ACCEPTANCE_CONTRACTS.map(({ id }) => id)).toEqual(
      Array.from(
        { length: 16 },
        (_, index) => `R2-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(
      RENEWAL2_ACCEPTANCE_CONTRACTS.every(
        ({ evidence, phase }) => phase >= 1 && evidence.length > 0,
      ),
    ).toBe(true);
  });

  it("allows individual point editing only for manual layers", () => {
    expect(RENEWAL2_LAYER_EDITING_PERMISSIONS).toEqual([
      expect.objectContaining({
        mode: "preset",
        canDeletePoint: false,
        canMovePoint: false,
        canReplacePointStar: false,
      }),
      expect.objectContaining({
        mode: "pattern",
        canDeletePoint: false,
        canMovePoint: false,
        canReplacePointStar: false,
      }),
      expect.objectContaining({
        mode: "manual",
        canDeletePoint: true,
        canMovePoint: true,
        canReplacePointStar: true,
      }),
    ]);
  });

  it("assigns advertise, check, and free runtimes to exclusive screens", () => {
    expect(RENEWAL2_BACKGROUND_RUNTIME_BY_SCREEN).toEqual({
      editor: "none",
      "initial-setup": "none",
      library: "none",
      "mode-select": "advertise",
      "viewer-check": "check",
      "viewer-free": "free",
    });
    expect(
      Object.values(RENEWAL2_BACKGROUND_RUNTIME_BY_SCREEN).filter(
        (runtime) => runtime !== "none",
      ),
    ).toEqual(["advertise", "check", "free"]);
  });
});
