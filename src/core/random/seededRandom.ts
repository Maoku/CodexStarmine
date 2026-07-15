export interface SeededRandom {
  next: () => number;
  range: (minimum: number, maximum: number) => number;
  signed: () => number;
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = Math.trunc(seed) >>> 0 || 0x6d2b79f5;
  const next = (): number => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    range: (minimum, maximum) => minimum + (maximum - minimum) * next(),
    signed: () => next() * 2 - 1,
  };
}

export function stableSeed(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
