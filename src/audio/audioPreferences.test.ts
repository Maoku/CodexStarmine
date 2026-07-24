import { describe, expect, it } from "vitest";

import {
  AUDIO_VOLUME_STORAGE_KEY,
  DEFAULT_AUDIO_VOLUME,
  loadAudioVolume,
  normalizeAudioVolume,
  saveAudioVolume,
} from "./audioPreferences";

describe("audio volume preferences", () => {
  it("normalizes finite volume values to the UI range", () => {
    expect(normalizeAudioVolume(-0.4)).toBe(0);
    expect(normalizeAudioVolume(0.634)).toBe(0.63);
    expect(normalizeAudioVolume(1.4)).toBe(1);
    expect(normalizeAudioVolume(Number.NaN)).toBe(DEFAULT_AUDIO_VOLUME);
  });

  it("loads a saved value and falls back for missing or invalid values", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
    };

    expect(loadAudioVolume(storage)).toBe(DEFAULT_AUDIO_VOLUME);
    values.set(AUDIO_VOLUME_STORAGE_KEY, "0.46");
    expect(loadAudioVolume(storage)).toBe(0.46);
    values.set(AUDIO_VOLUME_STORAGE_KEY, "not-a-number");
    expect(loadAudioVolume(storage)).toBe(DEFAULT_AUDIO_VOLUME);
  });

  it("saves a normalized value without failing when storage rejects writes", () => {
    const values = new Map<string, string>();
    saveAudioVolume(
      {
        setItem: (key, value) => values.set(key, value),
      },
      1.8,
    );
    expect(values.get(AUDIO_VOLUME_STORAGE_KEY)).toBe("1");

    expect(() =>
      saveAudioVolume(
        {
          setItem: () => {
            throw new Error("blocked");
          },
        },
        0.5,
      ),
    ).not.toThrow();
  });
});
