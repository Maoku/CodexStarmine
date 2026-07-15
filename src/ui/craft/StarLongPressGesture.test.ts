import { describe, expect, it } from "vitest";

import {
  STAR_LONG_PRESS_DELAY_MS,
  StarLongPressGesture,
} from "./StarLongPressGesture";

describe("StarLongPressGesture", () => {
  it("opens at 450ms and reports the opened star on pointer release", () => {
    const gesture = new StarLongPressGesture();
    gesture.begin("star-red", 7, 10, 20, 1_000);

    expect(gesture.activate(7, 1_000 + STAR_LONG_PRESS_DELAY_MS - 1)).toBe(
      undefined,
    );
    expect(gesture.activate(7, 1_000 + STAR_LONG_PRESS_DELAY_MS)).toBe(
      "star-red",
    );
    expect(gesture.end(7)).toBe("star-red");
  });

  it("cancels after moving more than 8px", () => {
    const gesture = new StarLongPressGesture();
    gesture.begin("star-blue", 3, 0, 0, 0);

    expect(gesture.move(3, 8, 0)).toBe(false);
    expect(gesture.move(3, 8.1, 0)).toBe(true);
    expect(gesture.activate(3, STAR_LONG_PRESS_DELAY_MS)).toBe(undefined);
  });

  it("does not activate after pointer cancellation", () => {
    const gesture = new StarLongPressGesture();
    gesture.begin("star-gold", 2, 0, 0, 0);
    gesture.cancel();

    expect(gesture.activate(2, STAR_LONG_PRESS_DELAY_MS)).toBe(undefined);
    expect(gesture.end(2)).toBe(undefined);
  });
});
