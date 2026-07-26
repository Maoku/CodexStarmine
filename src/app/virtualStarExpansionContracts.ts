export const VIRTUAL_STAR_EXPANSION_REGRESSION_SEED = 726_2026;

export const VIRTUAL_STAR_EXPANSION_BASELINE_VIEWPORTS = [
  {
    fallbackScreenshot: "virtual-star-balloon-fallback-1440x900.png",
    height: 900,
    screenshot: "virtual-star-balloon-1440x900.png",
    width: 1440,
  },
  {
    fallbackScreenshot: "virtual-star-balloon-fallback-1280x720.png",
    height: 720,
    screenshot: "virtual-star-balloon-1280x720.png",
    width: 1280,
  },
  {
    fallbackScreenshot: "virtual-star-balloon-fallback-390x844.png",
    height: 844,
    screenshot: "virtual-star-balloon-390x844.png",
    width: 390,
  },
] as const;

export const VIRTUAL_STAR_EXPANSION_PERFORMANCE_LIMITS = {
  maximumFrameRate: 30,
  maximumParentStars: 48,
  maximumPixelRatio: 1.5,
  maximumRuntimeParticles: 6_000,
  maximumSecondaryParticles: 192,
  maximumTrailVertices: 4_096,
  previewHeight: 116,
  previewWidth: 216,
} as const;

export const VIRTUAL_STAR_EXPANSION_COMPATIBILITY = {
  addEffectsToExistingDesigns: false,
  effectFieldsAreOptional: true,
  preserveLegacyFlickerMeaning: true,
  schemaVersion: 4,
  supportedSourceVersions: [2, 3, 4],
} as const;

export const VIRTUAL_STAR_EXPANSION_EXISTING_STAR_IDS = [
  "star-solid-red",
  "star-change-blue",
  "star-charcoal",
  "star-gold",
  "star-silver",
  "star-flicker",
  "star-long",
  "star-child",
] as const;

export const VIRTUAL_STAR_EXPANSION_EXISTING_PRESET_IDS = [
  "preset-chrysanthemum",
  "preset-peony",
  "preset-crown",
  "preset-palm",
  "preset-senrin",
  "preset-heart",
  "preset-willow",
  "preset-bee",
  "preset-hiyusei",
  "preset-hanarai",
  "preset-kaleidoscope",
  "preset-saturn",
  "preset-butterfly",
  "preset-kowari",
] as const;
