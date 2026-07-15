export const FREE_VIEW_PRESET_IDS = [
  "audience",
  "wide",
  "launch-site",
  "inside-burst",
] as const;

export type FreeViewPresetId = (typeof FREE_VIEW_PRESET_IDS)[number];

export interface FreeViewPreset {
  fov: number;
  label: string;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

export const HOME_FREE_VIEW_PRESET_ID: FreeViewPresetId = "audience";

export const FREE_VIEW_PRESETS: Record<FreeViewPresetId, FreeViewPreset> = {
  audience: {
    fov: 60,
    label: "湖畔固定席",
    position: [0, 13, 74],
    target: [0, 95, -155],
  },
  wide: {
    fov: 68,
    label: "湖畔ワイド",
    position: [-126, 50, 88],
    target: [0, 112, -132],
  },
  "launch-site": {
    fov: 64,
    label: "打上島そば",
    position: [58, 20, -58],
    target: [0, 112, -116],
  },
  "inside-burst": {
    fov: 76,
    label: "花火の内側",
    position: [0, 142, -112],
    target: [0, 142, -180],
  },
};

export function isFreeViewPresetId(value: string): value is FreeViewPresetId {
  return FREE_VIEW_PRESET_IDS.some((presetId) => presetId === value);
}
