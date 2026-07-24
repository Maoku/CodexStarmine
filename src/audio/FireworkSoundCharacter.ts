import type { CompiledBurstPlan } from "../core/burst";
import type {
  FireworkDesign,
  FireworkPattern,
  VirtualStarPreset,
} from "../data";

export type FireworkSoundStyle =
  "classic" | "graphic" | "heavy" | "cluster" | "spinner" | "thunder";

export interface MovingSoundVoice {
  delay: number;
  duration: number;
  endFrequency: number;
  endPanOffset: number;
  gain: number;
  startFrequency: number;
  startPanOffset: number;
}

export interface SecondarySoundReport {
  brightness: number;
  delay: number;
  panOffset: number;
  strength: number;
}

export interface StarSoundMix {
  crackle: number;
  deep: number;
  flicker: number;
  silverTail: number;
  soft: number;
  warmTail: number;
}

export interface FireworkSoundCharacter {
  bodyBrightness: number;
  bodyDurationScale: number;
  crackleScale: number;
  lowEndScale: number;
  movingVoices: MovingSoundVoice[];
  reflectionScale: number;
  reportScale: number;
  reverbScale: number;
  rumbleScale: number;
  secondaryReports: SecondarySoundReport[];
  starMix: StarSoundMix;
  style: FireworkSoundStyle;
  tailSizzleCount: number;
  tailSizzleDuration: number;
  tailSizzleFrequency: number;
}

interface PatternSoundProfile {
  bodyBrightness: number;
  bodyDurationScale: number;
  crackleScale: number;
  lowEndScale: number;
  movingDuration: number;
  movingEndFrequency: number;
  movingGain: number;
  movingStartFrequency: number;
  movingVoiceCount: number;
  reflectionScale: number;
  reportScale: number;
  reverbScale: number;
  rumbleScale: number;
  secondaryGain: number;
  style: FireworkSoundStyle;
}

const CLASSIC: PatternSoundProfile = {
  bodyBrightness: 1,
  bodyDurationScale: 1,
  crackleScale: 1,
  lowEndScale: 1,
  movingDuration: 0,
  movingEndFrequency: 0,
  movingGain: 0,
  movingStartFrequency: 0,
  movingVoiceCount: 0,
  reflectionScale: 1,
  reportScale: 1,
  reverbScale: 1,
  rumbleScale: 1,
  secondaryGain: 0.46,
  style: "classic",
};

const PATTERN_SOUND_PROFILES: Record<FireworkPattern, PatternSoundProfile> = {
  chrysanthemum: {
    ...CLASSIC,
    crackleScale: 1.08,
    lowEndScale: 1.04,
    reportScale: 1.04,
  },
  peony: {
    ...CLASSIC,
    bodyBrightness: 0.9,
    crackleScale: 0.72,
    reflectionScale: 0.84,
    reportScale: 0.94,
    reverbScale: 0.88,
  },
  crown: {
    ...CLASSIC,
    bodyBrightness: 0.72,
    bodyDurationScale: 1.48,
    crackleScale: 0.76,
    lowEndScale: 1.26,
    reflectionScale: 1.42,
    reportScale: 0.9,
    reverbScale: 1.38,
    rumbleScale: 1.38,
    style: "heavy",
  },
  palm: {
    ...CLASSIC,
    bodyBrightness: 0.84,
    bodyDurationScale: 1.2,
    crackleScale: 1.16,
    lowEndScale: 1.15,
    reflectionScale: 1.1,
    reverbScale: 1.12,
    rumbleScale: 1.14,
    style: "heavy",
  },
  senrin: {
    ...CLASSIC,
    bodyBrightness: 1.08,
    bodyDurationScale: 0.82,
    lowEndScale: 0.88,
    reflectionScale: 0.82,
    reportScale: 0.9,
    reverbScale: 0.84,
    secondaryGain: 0.72,
    style: "cluster",
  },
  heart: {
    ...CLASSIC,
    bodyBrightness: 1.08,
    bodyDurationScale: 0.82,
    crackleScale: 0.58,
    lowEndScale: 0.82,
    reflectionScale: 0.72,
    reportScale: 0.82,
    reverbScale: 0.76,
    style: "graphic",
  },
  willow: {
    ...CLASSIC,
    bodyBrightness: 0.64,
    bodyDurationScale: 1.62,
    crackleScale: 0.56,
    lowEndScale: 1.3,
    reflectionScale: 1.52,
    reportScale: 0.84,
    reverbScale: 1.5,
    rumbleScale: 1.45,
    style: "heavy",
  },
  bee: {
    ...CLASSIC,
    bodyBrightness: 1.1,
    bodyDurationScale: 0.72,
    crackleScale: 1.16,
    lowEndScale: 0.7,
    movingDuration: 0.76,
    movingEndFrequency: 520,
    movingGain: 0.022,
    movingStartFrequency: 310,
    movingVoiceCount: 5,
    reflectionScale: 0.56,
    reportScale: 0.72,
    reverbScale: 0.68,
    style: "spinner",
  },
  hiyusei: {
    ...CLASSIC,
    bodyBrightness: 1.18,
    bodyDurationScale: 0.84,
    crackleScale: 0.92,
    lowEndScale: 0.76,
    movingDuration: 1.04,
    movingEndFrequency: 1_080,
    movingGain: 0.016,
    movingStartFrequency: 620,
    movingVoiceCount: 4,
    reflectionScale: 0.7,
    reportScale: 0.8,
    reverbScale: 0.9,
    style: "spinner",
  },
  hanarai: {
    ...CLASSIC,
    bodyBrightness: 1.42,
    bodyDurationScale: 0.62,
    crackleScale: 1.72,
    lowEndScale: 1.08,
    reflectionScale: 0.72,
    reportScale: 1.38,
    reverbScale: 0.58,
    rumbleScale: 0.92,
    secondaryGain: 0.9,
    style: "thunder",
  },
  kaleidoscope: {
    ...CLASSIC,
    bodyBrightness: 1.1,
    bodyDurationScale: 0.78,
    crackleScale: 0.9,
    lowEndScale: 0.8,
    reflectionScale: 0.76,
    reportScale: 0.86,
    reverbScale: 0.82,
    secondaryGain: 0.62,
    style: "cluster",
  },
  saturn: {
    ...CLASSIC,
    bodyBrightness: 1.04,
    bodyDurationScale: 0.88,
    crackleScale: 0.62,
    lowEndScale: 0.9,
    reflectionScale: 0.8,
    reportScale: 0.86,
    reverbScale: 0.84,
    style: "graphic",
  },
  butterfly: {
    ...CLASSIC,
    bodyBrightness: 1.14,
    bodyDurationScale: 0.78,
    crackleScale: 0.66,
    lowEndScale: 0.76,
    reflectionScale: 0.68,
    reportScale: 0.8,
    reverbScale: 0.76,
    style: "graphic",
  },
  kowari: {
    ...CLASSIC,
    bodyBrightness: 0.94,
    bodyDurationScale: 0.88,
    crackleScale: 1.04,
    lowEndScale: 1.05,
    reflectionScale: 0.88,
    reportScale: 0.92,
    reverbScale: 0.9,
    secondaryGain: 0.8,
    style: "cluster",
  },
};

interface StarSoundCounts {
  crackle: number;
  deep: number;
  flicker: number;
  silverTail: number;
  soft: number;
  total: number;
  warmTail: number;
}

function emptyCounts(): StarSoundCounts {
  return {
    crackle: 0,
    deep: 0,
    flicker: 0,
    silverTail: 0,
    soft: 0,
    total: 0,
    warmTail: 0,
  };
}

function countDefinition(
  counts: StarSoundCounts,
  definition: VirtualStarPreset | undefined,
  weight = 1,
): void {
  if (!definition || weight <= 0) return;
  counts[definition.soundTag] += weight;
  counts.total += weight;
  if (definition.emissionKind === "flicker") counts.flicker += weight;
  if (definition.emissionKind === "silverTail") counts.silverTail += weight;
  if (
    definition.emissionKind === "goldTail" ||
    definition.emissionKind === "charcoalTail"
  ) {
    counts.warmTail += weight;
  }
}

function starSoundMix(
  design: FireworkDesign,
  plan?: CompiledBurstPlan,
): StarSoundMix {
  const counts = emptyCounts();
  if (plan) {
    for (const star of plan.stars) {
      countDefinition(counts, star.definition);
    }
    for (const child of plan.childBursts) {
      for (const star of child.stars) {
        countDefinition(counts, star.definition);
      }
    }
  } else {
    for (const layer of design.layers) {
      if (!layer.visible) continue;
      countDefinition(
        counts,
        design.starDefinitions[layer.defaultStarId],
        layer.kind === "child" ? Math.max(layer.count, 1) : 1,
      );
    }
  }

  if (counts.total <= 0) {
    return {
      crackle: 0,
      deep: 0,
      flicker: 0,
      silverTail: 0,
      soft: 1,
      warmTail: 0,
    };
  }
  return {
    crackle: counts.crackle / counts.total,
    deep: counts.deep / counts.total,
    flicker: counts.flicker / counts.total,
    silverTail: counts.silverTail / counts.total,
    soft: counts.soft / counts.total,
    warmTail: counts.warmTail / counts.total,
  };
}

function sampleDelays(delays: number[], maximum = 12): number[] {
  const sorted = delays
    .filter((delay) => Number.isFinite(delay) && delay >= 0)
    .sort((left, right) => left - right);
  if (sorted.length <= maximum) return sorted;
  return Array.from({ length: maximum }, (_, index) => {
    const sourceIndex = Math.min(
      Math.floor((index / maximum) * sorted.length),
      sorted.length - 1,
    );
    return sorted[sourceIndex];
  });
}

function secondaryDelays(
  design: FireworkDesign,
  plan?: CompiledBurstPlan,
): number[] {
  if (plan?.childBursts.length) {
    return sampleDelays(plan.childBursts.map((child) => child.delay));
  }
  return sampleDelays(
    design.childBursts.flatMap((burst) =>
      Array.from(
        { length: Math.max(Math.round(burst.count), 0) },
        (_, index) => burst.delay + index * 0.035,
      ),
    ),
  );
}

function movingVoices(profile: PatternSoundProfile): MovingSoundVoice[] {
  return Array.from({ length: profile.movingVoiceCount }, (_, index) => {
    const direction = index % 2 === 0 ? 1 : -1;
    const pitchVariation = 0.9 + (index % 3) * 0.09;
    return {
      delay: 0.11 + index * 0.085,
      duration: profile.movingDuration * (0.82 + (index % 3) * 0.1),
      endFrequency: profile.movingEndFrequency * pitchVariation,
      endPanOffset: direction * (0.32 + (index % 2) * 0.14),
      gain: profile.movingGain * (0.86 + (index % 3) * 0.08),
      startFrequency: profile.movingStartFrequency * pitchVariation,
      startPanOffset: direction * -0.28,
    };
  });
}

export function deriveFireworkSoundCharacter(
  design: FireworkDesign,
  plan?: CompiledBurstPlan,
): FireworkSoundCharacter {
  const profile = PATTERN_SOUND_PROFILES[design.pattern];
  const mix = starSoundMix(design, plan);
  const familyLowEnd =
    design.family === "hanwarimono"
      ? 0.96
      : design.family === "pokamono"
        ? 0.94
        : 1;
  const familyReverb = design.family === "pokamono" ? 1.06 : 1;
  const delays = secondaryDelays(design, plan);
  const secondaryGain =
    profile.secondaryGain *
    (design.family === "hanwarimono" ? 1.08 : 1) *
    (0.9 + mix.crackle * 0.2);
  const metallicTail = mix.warmTail + mix.silverTail + mix.flicker;

  return {
    bodyBrightness:
      profile.bodyBrightness *
      (1 + mix.silverTail * 0.18 + mix.flicker * 0.12 - mix.warmTail * 0.08),
    bodyDurationScale: profile.bodyDurationScale * (1 + mix.warmTail * 0.16),
    crackleScale: profile.crackleScale * (1 + mix.crackle * 0.92),
    lowEndScale: profile.lowEndScale * familyLowEnd * (1 + mix.deep * 0.4),
    movingVoices: movingVoices(profile),
    reflectionScale: profile.reflectionScale * (1 + mix.deep * 0.2),
    reportScale: profile.reportScale * (1 + mix.deep * 0.12),
    reverbScale: profile.reverbScale * familyReverb * (1 + mix.warmTail * 0.12),
    rumbleScale: profile.rumbleScale * (1 + mix.deep * 0.42),
    secondaryReports: delays.map((delay, index) => ({
      brightness: 0.9 + (index % 3) * 0.1,
      delay,
      panOffset: Math.sin((index + 1) * 2.399) * 0.42,
      strength: secondaryGain * (0.86 + (index % 4) * 0.045),
    })),
    starMix: mix,
    style: profile.style,
    tailSizzleCount: Math.min(
      Math.round(metallicTail * 9 + mix.crackle * 4),
      12,
    ),
    tailSizzleDuration:
      0.55 + mix.warmTail * 0.9 + mix.silverTail * 0.35 + mix.flicker * 0.2,
    tailSizzleFrequency:
      metallicTail > 0
        ? (mix.warmTail * 2_800 +
            mix.silverTail * 5_400 +
            mix.flicker * 6_400) /
          metallicTail
        : 4_200,
  };
}
