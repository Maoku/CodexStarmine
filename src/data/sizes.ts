import type { FireworkDesign, SizeClass } from "./firework";

export interface SizePreset {
  burstScale: number;
  label: string;
  particleScale: number;
  pointScale: number;
  sizeClass: SizeClass;
  targetHeight: number;
}

export const SIZE_PRESETS: Record<SizeClass, SizePreset> = {
  small: {
    sizeClass: "small",
    label: "3号 · Small",
    targetHeight: 104,
    burstScale: 0.72,
    particleScale: 0.62,
    pointScale: 0.88,
  },
  medium: {
    sizeClass: "medium",
    label: "5号 · Medium",
    targetHeight: 142,
    burstScale: 1,
    particleScale: 1,
    pointScale: 1,
  },
  large: {
    sizeClass: "large",
    label: "10号 · Large",
    targetHeight: 165,
    burstScale: 1.46,
    particleScale: 1.48,
    pointScale: 1.24,
  },
};

export function resolveSizePreset(sizeClass: SizeClass): SizePreset {
  return SIZE_PRESETS[sizeClass];
}

export function withSizeClass(
  design: FireworkDesign,
  sizeClass: SizeClass,
): FireworkDesign {
  return { ...design, sizeClass };
}
