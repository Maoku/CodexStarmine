export const SPEED_OF_SOUND_METERS_PER_SECOND = 343;

export function calculateSoundDelay(
  distanceMeters: number,
  physicality = 1,
  soundSpeed = SPEED_OF_SOUND_METERS_PER_SECOND,
): number {
  const distance = Number.isFinite(distanceMeters)
    ? Math.max(distanceMeters, 0)
    : 0;
  const blend = Number.isFinite(physicality)
    ? Math.min(Math.max(physicality, 0), 1)
    : 1;
  const speed = Number.isFinite(soundSpeed) ? Math.max(soundSpeed, 1) : 1;
  return (distance / speed) * blend;
}
