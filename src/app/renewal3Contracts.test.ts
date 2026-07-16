import { describe, expect, it } from "vitest";

import {
  RENEWAL3_ACCEPTANCE_CONTRACTS,
  RENEWAL3_CHECK_SEED,
  RENEWAL3_PREVIEW_SEED,
} from "./renewal3Contracts";

describe("Renewal3 acceptance contracts", () => {
  it("tracks every R3 requirement with an implementation phase and evidence", () => {
    expect(RENEWAL3_ACCEPTANCE_CONTRACTS.map(({ id }) => id)).toEqual(
      Array.from(
        { length: 17 },
        (_, index) => `R3-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(
      RENEWAL3_ACCEPTANCE_CONTRACTS.every(
        ({ evidence, phase, requirement }) =>
          phase >= 0 &&
          phase <= 7 &&
          evidence.length > 0 &&
          requirement.length > 0,
      ),
    ).toBe(true);
  });

  it("assigns the requested work to the intended implementation phases", () => {
    const phaseFor = (id: string) =>
      RENEWAL3_ACCEPTANCE_CONTRACTS.find((contract) => contract.id === id)
        ?.phase;

    expect(phaseFor("R3-07")).toBe(1);
    expect(phaseFor("R3-02")).toBe(2);
    expect(phaseFor("R3-08")).toBe(3);
    expect(phaseFor("R3-10")).toBe(4);
    expect(phaseFor("R3-11")).toBe(5);
    expect(phaseFor("R3-14")).toBe(6);
    expect(phaseFor("R3-17")).toBe(7);
  });

  it("keeps editor preview and lake check seeds explicit and distinct", () => {
    expect(Number.isInteger(RENEWAL3_PREVIEW_SEED)).toBe(true);
    expect(Number.isInteger(RENEWAL3_CHECK_SEED)).toBe(true);
    expect(RENEWAL3_PREVIEW_SEED).not.toBe(RENEWAL3_CHECK_SEED);
  });
});
