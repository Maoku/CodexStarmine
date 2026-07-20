import { describe, expect, it } from "vitest";

import {
  CRAFT_EDITOR_REFINE_ACCEPTANCE_CONTRACTS,
  CRAFT_EDITOR_REFINE_RENEWAL3_OVERRIDES,
  CRAFT_EDITOR_REFINE_TEST_HOOKS,
} from "./craftEditorRefineContracts";

describe("craft editor refine acceptance contracts", () => {
  it("keeps the Renewal3 plane-selection overrides explicit", () => {
    expect(
      CRAFT_EDITOR_REFINE_RENEWAL3_OVERRIDES.map(
        ({ renewal3Id }) => renewal3Id,
      ),
    ).toEqual(["R3-02", "R3-03"]);
    expect(CRAFT_EDITOR_REFINE_RENEWAL3_OVERRIDES[0].replacement).toContain(
      "X/Y/Z",
    );
    expect(CRAFT_EDITOR_REFINE_RENEWAL3_OVERRIDES[1].replacement).toContain(
      "five-step",
    );
  });

  it("assigns every refine requirement to a phase and evidence", () => {
    const ids = CRAFT_EDITOR_REFINE_ACCEPTANCE_CONTRACTS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      CRAFT_EDITOR_REFINE_ACCEPTANCE_CONTRACTS.every(
        ({ evidence, requirement }) =>
          evidence.length > 0 && requirement.length > 0,
      ),
    ).toBe(true);
  });

  it("reserves unique stable UI hooks for browser and DOM checks", () => {
    expect(new Set(CRAFT_EDITOR_REFINE_TEST_HOOKS).size).toBe(
      CRAFT_EDITOR_REFINE_TEST_HOOKS.length,
    );
    expect(
      CRAFT_EDITOR_REFINE_TEST_HOOKS.every((hook) => hook.startsWith("data-")),
    ).toBe(true);
  });
});
