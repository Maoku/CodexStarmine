import { describe, expect, it } from "vitest";

import { BUILTIN_STAR_PRESETS, snapshotStarLibrary } from "./starPresets";

describe("virtual star presets", () => {
  it("adds five Phase 2 effects without changing the existing prefix", () => {
    const phase2 = BUILTIN_STAR_PRESETS.filter(({ id }) =>
      [
        "star-strobe-white-hard",
        "star-strobe-pastel",
        "star-kouro",
        "star-teka",
        "star-repeat-change",
      ].includes(id),
    );
    expect(phase2.map(({ id }) => id)).toEqual([
      "star-strobe-white-hard",
      "star-strobe-pastel",
      "star-kouro",
      "star-teka",
      "star-repeat-change",
    ]);
    expect(phase2).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectProfile: {
            light: expect.objectContaining({ mode: "strobe" }),
          },
        }),
        expect.objectContaining({
          effectProfile: {
            light: expect.objectContaining({
              terminal: expect.objectContaining({ mode: "kouro" }),
            }),
          },
        }),
        expect.objectContaining({
          effectProfile: {
            light: expect.objectContaining({
              terminal: expect.objectContaining({ mode: "teka" }),
            }),
          },
        }),
      ]),
    );
  });

  it("adds relay and gradient stars for Phase 3 timing layouts", () => {
    expect(
      BUILTIN_STAR_PRESETS.filter(({ id }) =>
        ["star-relay-light", "star-gradient-fade"].includes(id),
      ),
    ).toMatchObject([
      {
        effectProfile: {
          color: { playback: "loop" },
          light: { mode: "strobe" },
        },
        id: "star-relay-light",
      },
      {
        effectProfile: {
          color: { mode: "smooth", playback: "loop" },
          light: { mode: "continuous" },
        },
        id: "star-gradient-fade",
      },
    ]);
  });

  it("adds leaf motion and terminal popping stars for Phase 4", () => {
    expect(BUILTIN_STAR_PRESETS.slice(-2)).toMatchObject([
      {
        effectProfile: {
          light: { mode: "strobe" },
          motion: { mode: "fallingLeaf" },
        },
        id: "star-strobe-leaf",
      },
      {
        effectProfile: {
          secondary: { count: 5, mode: "microBurst" },
        },
        id: "star-popping",
      },
    ]);
  });

  it("returns independent effect profiles from the library snapshot", () => {
    const first = snapshotStarLibrary();
    const second = snapshotStarLibrary();
    first["star-strobe-white-hard"].effectProfile!.light!.frequencyHz = 2;
    expect(
      second["star-strobe-white-hard"].effectProfile?.light?.frequencyHz,
    ).toBe(8);
  });
});
