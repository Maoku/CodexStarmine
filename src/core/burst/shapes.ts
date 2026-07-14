import type { Vector3Value } from "../particle";
import type { BurstDirection } from "./sphere";

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function generateHeartBurst(count: number, seed = 1): BurstDirection[] {
  const random = seededRandom(seed);
  const safeCount = Math.max(Math.floor(count), 8);
  const result: BurstDirection[] = [];
  for (let index = 0; index < safeCount; index += 1) {
    const angle = (index / safeCount) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(angle), 3);
    const y =
      13 * Math.cos(angle) -
      5 * Math.cos(2 * angle) -
      2 * Math.cos(3 * angle) -
      Math.cos(4 * angle);
    const layer = 0.92 + (random() - 0.5) * 0.12;
    result.push({
      direction: {
        x: (x / 18) * layer,
        y: (y / 18) * layer + 0.12,
        z: (random() - 0.5) * 0.025,
      },
      speedFactor: 0.96 + random() * 0.08,
    });
  }
  return result;
}

export function generatePalmBurst(count: number, seed = 1): BurstDirection[] {
  const random = seededRandom(seed);
  const branchCount = Math.max(7, Math.min(14, Math.round(count / 7)));
  const particlesPerBranch = Math.max(5, Math.round(count / branchCount));
  const result: BurstDirection[] = [];

  for (let branch = 0; branch < branchCount; branch += 1) {
    const azimuth = (branch / branchCount) * Math.PI * 2 + random() * 0.16;
    const rise = 0.16 + random() * 0.62;
    const horizontal = Math.sqrt(1 - rise * rise);
    const direction: Vector3Value = {
      x: Math.cos(azimuth) * horizontal,
      y: rise,
      z: Math.sin(azimuth) * horizontal,
    };
    for (let index = 0; index < particlesPerBranch; index += 1) {
      result.push({
        direction: {
          x: direction.x + (random() - 0.5) * 0.045,
          y: direction.y + (random() - 0.5) * 0.04,
          z: direction.z + (random() - 0.5) * 0.045,
        },
        speedFactor: 0.76 + (index / particlesPerBranch) * 0.35,
      });
    }
  }
  return result;
}
