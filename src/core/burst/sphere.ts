import type { Vector3Value } from "../particle";

export interface BurstDirection {
  direction: Vector3Value;
  speedFactor: number;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(1_664_525, value) + 1_013_904_223;
    return (value >>> 0) / 4_294_967_296;
  };
}

export function generateSphereBurst(
  count: number,
  symmetry = 1,
  seed = 1,
): BurstDirection[] {
  const safeCount = Math.max(Math.floor(count), 1);
  const random = seededRandom(seed);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const jitter = (1 - Math.min(Math.max(symmetry, 0), 1)) * 0.42;
  const result: BurstDirection[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    const y = 1 - ((index + 0.5) / safeCount) * 2;
    const radius = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = goldenAngle * index + (random() - 0.5) * jitter;
    const direction = {
      x: Math.cos(theta) * radius + (random() - 0.5) * jitter,
      y: y + (random() - 0.5) * jitter,
      z: Math.sin(theta) * radius + (random() - 0.5) * jitter,
    };
    const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
    result.push({
      direction: {
        x: direction.x / length,
        y: direction.y / length,
        z: direction.z / length,
      },
      speedFactor: 0.9 + random() * 0.2,
    });
  }

  return result;
}
