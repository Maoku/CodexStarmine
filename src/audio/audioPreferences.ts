export const AUDIO_VOLUME_STORAGE_KEY = "codex-starmine.audio-volume.v1";
export const DEFAULT_AUDIO_VOLUME = 0.7;

type AudioPreferenceReader = Pick<Storage, "getItem">;
type AudioPreferenceWriter = Pick<Storage, "setItem">;

export function normalizeAudioVolume(
  value: number,
  fallback = DEFAULT_AUDIO_VOLUME,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;
}

export function loadAudioVolume(storage?: AudioPreferenceReader): number {
  if (!storage) return DEFAULT_AUDIO_VOLUME;
  try {
    const raw = storage.getItem(AUDIO_VOLUME_STORAGE_KEY);
    if (raw === null || raw.trim() === "") return DEFAULT_AUDIO_VOLUME;
    return normalizeAudioVolume(Number(raw));
  } catch {
    return DEFAULT_AUDIO_VOLUME;
  }
}

export function saveAudioVolume(
  storage: AudioPreferenceWriter | undefined,
  value: number,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      AUDIO_VOLUME_STORAGE_KEY,
      String(normalizeAudioVolume(value)),
    );
  } catch {
    // Audio still works when storage is unavailable (private browsing, quota,
    // or embedded contexts); only persistence is skipped.
  }
}
