export const STAR_LONG_PRESS_DELAY_MS = 450;
export const STAR_LONG_PRESS_MOVE_THRESHOLD_PX = 8;

interface LongPressCandidate {
  opened: boolean;
  pointerId: number;
  starId: string;
  startTime: number;
  startX: number;
  startY: number;
}

export class StarLongPressGesture {
  #candidate?: LongPressCandidate;

  begin(
    starId: string,
    pointerId: number,
    x: number,
    y: number,
    startTime: number,
  ): void {
    this.#candidate = {
      opened: false,
      pointerId,
      starId,
      startTime,
      startX: x,
      startY: y,
    };
  }

  move(pointerId: number, x: number, y: number): boolean {
    const candidate = this.#candidate;
    if (!candidate || candidate.pointerId !== pointerId) return false;
    if (
      Math.hypot(x - candidate.startX, y - candidate.startY) <=
      STAR_LONG_PRESS_MOVE_THRESHOLD_PX
    ) {
      return false;
    }
    this.#candidate = undefined;
    return true;
  }

  activate(pointerId: number, currentTime: number): string | undefined {
    const candidate = this.#candidate;
    if (
      !candidate ||
      candidate.pointerId !== pointerId ||
      currentTime - candidate.startTime < STAR_LONG_PRESS_DELAY_MS
    ) {
      return undefined;
    }
    candidate.opened = true;
    return candidate.starId;
  }

  end(pointerId: number): string | undefined {
    const candidate = this.#candidate;
    if (!candidate || candidate.pointerId !== pointerId) return undefined;
    this.#candidate = undefined;
    return candidate.opened ? candidate.starId : undefined;
  }

  cancel(): void {
    this.#candidate = undefined;
  }
}
