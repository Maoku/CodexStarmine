import type { ColorStage, VirtualStarPreset } from "./firework";

function stages(colors: number[]): ColorStage[] {
  return colors.map((color, index) => ({
    color,
    intensity: index === colors.length - 1 ? 0 : 1.08 - index * 0.12,
    normalizedTime: colors.length === 1 ? 0 : index / (colors.length - 1),
    trailColor: color,
  }));
}

function star(
  id: string,
  displayName: string,
  colors: number[],
  overrides: Partial<VirtualStarPreset> = {},
): VirtualStarPreset {
  return {
    brightness: 1,
    burnDuration: 2.5,
    colorStages: stages(colors),
    displayName,
    drag: 0.55,
    emissionKind: "point",
    flicker: 0.08,
    gravityScale: 0.8,
    id,
    smokeAmount: 0.35,
    soundTag: "soft",
    trailLifetime: 0.08,
    trailWidth: 0.9,
    ...overrides,
  };
}

export const BUILTIN_STAR_PRESETS: VirtualStarPreset[] = [
  star("star-solid-red", "赤の単色星", [0xfff0df, 0xff3b42, 0x5f171c]),
  star("star-change-blue", "青から銀の変化星", [0xffffff, 0x397dff, 0xd8efff], {
    burnDuration: 3.1,
  }),
  star("star-charcoal", "炭火引・赤から銀", [0xffb26d, 0xe43e32, 0xeaf6ff], {
    burnDuration: 3.7,
    emissionKind: "charcoalTail",
    gravityScale: 1.05,
    smokeAmount: 0.62,
    trailLifetime: 0.9,
    trailWidth: 1.05,
  }),
  star("star-gold", "金引星", [0xfff1ad, 0xffb52d, 0x8b5821], {
    brightness: 1.18,
    burnDuration: 4.2,
    emissionKind: "goldTail",
    gravityScale: 1.25,
    trailLifetime: 1,
    trailWidth: 1.18,
  }),
  star("star-silver", "銀引星", [0xffffff, 0xbfe4ff, 0x6c7f96], {
    brightness: 1.25,
    emissionKind: "silverTail",
    trailLifetime: 0.88,
    trailWidth: 1.08,
  }),
  star("star-flicker", "白銀の点滅星", [0xffffff, 0xa8cfff, 0xf8ffff], {
    brightness: 1.28,
    emissionKind: "flicker",
    flicker: 0.86,
    soundTag: "crackle",
  }),
  star("star-long", "長寿命の冠星", [0xffefba, 0xd6933c, 0x714b28], {
    burnDuration: 5.4,
    drag: 0.34,
    emissionKind: "goldTail",
    gravityScale: 1.72,
    trailLifetime: 1,
  }),
  star("star-child", "時間差の子花星", [0xffd6ea, 0xff4f91, 0x55dfff], {
    burnDuration: 1.55,
    emissionKind: "child",
    flicker: 0.32,
    soundTag: "crackle",
    trailLifetime: 0.18,
  }),
  star("star-strobe-white-hard", "強白点滅星", [0xffffff, 0xeaf7ff, 0xffffff], {
    brightness: 1.42,
    burnDuration: 2.4,
    effectProfile: {
      light: {
        dutyCycle: 0.28,
        edgeSoftness: 0.025,
        frequencyHz: 8,
        mode: "strobe",
      },
    },
    flicker: 0,
    soundTag: "crackle",
  }),
  star(
    "star-strobe-pastel",
    "彩色パステル点滅星",
    [0xfff5fb, 0xff9fcf, 0xffef8f, 0x8eeeff],
    {
      brightness: 1.26,
      burnDuration: 3,
      effectProfile: {
        color: { mode: "step", playback: "loop", repeatCount: 2 },
        light: {
          dutyCycle: 0.42,
          edgeSoftness: 0.045,
          frequencyHz: 6,
          mode: "strobe",
        },
      },
      flicker: 0,
    },
  ),
  star("star-kouro", "銀光露星", [0xffffff, 0xcceaff, 0x8cb7d4], {
    brightness: 1.3,
    burnDuration: 3.2,
    effectProfile: {
      light: {
        mode: "continuous",
        terminal: {
          duration: 0.16,
          mode: "kouro",
          sparkleCount: 3,
          strength: 1.25,
        },
      },
    },
    emissionKind: "silverTail",
    trailLifetime: 0.56,
    trailWidth: 1.05,
  }),
  star("star-teka", "白銀輝星", [0xffffff, 0xe7f5ff, 0xffffff], {
    brightness: 1.36,
    burnDuration: 2.65,
    effectProfile: {
      light: {
        mode: "continuous",
        terminal: {
          duration: 0.07,
          mode: "teka",
          sparkleCount: 5,
          strength: 2.6,
        },
      },
    },
    emissionKind: "silverTail",
    flicker: 0.12,
    soundTag: "crackle",
    trailLifetime: 0.34,
  }),
  star("star-repeat-change", "紅青反復変化星", [0xfff4ee, 0xff405c, 0x4d8dff], {
    brightness: 1.18,
    burnDuration: 3.6,
    effectProfile: {
      color: { mode: "step", playback: "pingPong", repeatCount: 4 },
    },
    flicker: 0,
    trailLifetime: 0.16,
  }),
  star(
    "star-relay-light",
    "時差リレー星",
    [0xffffff, 0xff9fcf, 0xffed8f, 0x8feaff],
    {
      brightness: 1.3,
      burnDuration: 3.2,
      effectProfile: {
        color: { mode: "step", playback: "loop", repeatCount: 1 },
        light: {
          dutyCycle: 0.24,
          edgeSoftness: 0.035,
          frequencyHz: 1.55,
          mode: "strobe",
        },
      },
      flicker: 0,
      trailLifetime: 0.1,
    },
  ),
  star(
    "star-gradient-fade",
    "流光グラデーション星",
    [0xfff7fb, 0xff9fcf, 0xffef91, 0x8feaff, 0xb99aff],
    {
      brightness: 1.22,
      burnDuration: 3.8,
      effectProfile: {
        color: { mode: "smooth", playback: "loop", repeatCount: 1 },
        light: { mode: "continuous" },
      },
      flicker: 0,
      trailLifetime: 0.2,
    },
  ),
];

export function snapshotStarLibrary(): Record<string, VirtualStarPreset> {
  return Object.fromEntries(
    BUILTIN_STAR_PRESETS.map((preset) => [preset.id, structuredClone(preset)]),
  );
}
