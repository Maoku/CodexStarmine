import { describe, expect, it } from "vitest";

import {
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

  it("keeps abstract previews independent from production rendering", () => {
    const abstractPreviews = RENEWAL_PREVIEW_RESPONSIBILITIES.filter(
      ({ result }) => result === "abstract",
    );
    const productionPreviews = RENEWAL_PREVIEW_RESPONSIBILITIES.filter(
      ({ result }) => result === "production",
    );

    expect(
      abstractPreviews.every(({ renderer }) => renderer === "abstract-2d"),
    ).toBe(true);
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
});
