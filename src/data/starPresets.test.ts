import { describe, expect, it } from "vitest";

import { BUILTIN_STAR_PRESETS, snapshotStarLibrary } from "./starPresets";

describe("virtual star presets", () => {
  it("adds five Phase 2 effects without changing the existing prefix", () => {
    expect(BUILTIN_STAR_PRESETS.slice(-5).map(({ id }) => id)).toEqual([
      "star-strobe-white-hard",
      "star-strobe-pastel",
      "star-kouro",
      "star-teka",
      "star-repeat-change",
    ]);
    expect(BUILTIN_STAR_PRESETS.slice(-5)).toEqual(
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

  it("returns independent effect profiles from the library snapshot", () => {
    const first = snapshotStarLibrary();
    const second = snapshotStarLibrary();
    first["star-strobe-white-hard"].effectProfile!.light!.frequencyHz = 2;
    expect(
      second["star-strobe-white-hard"].effectProfile?.light?.frequencyHz,
    ).toBe(8);
  });
});
