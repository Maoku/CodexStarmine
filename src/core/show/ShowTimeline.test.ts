import { describe, expect, it } from "vitest";

import type { ShowCue } from "../../data";
import { ShowTimelinePlayer } from "./ShowTimeline";

function cue(id: string, time: number): ShowCue {
  return {
    id,
    time,
    launcherLane: 0,
    launchAngle: 0,
    fireworkDesignID: "preset-chrysanthemum",
    sizePreset: "medium",
    targetHeight: 142,
    timingVariation: 0,
  };
}

describe("ShowTimelinePlayer", () => {
  it("emits time-ordered cues exactly once", () => {
    const player = new ShowTimelinePlayer();
    player.play([cue("late", 1), cue("start", 0), cue("middle", 0.5)], 1.2);
    expect(player.update(0).map((item) => item.id)).toEqual(["start"]);
    expect(player.update(0.5).map((item) => item.id)).toEqual(["middle"]);
    expect(player.update(0.5).map((item) => item.id)).toEqual(["late"]);
    expect(player.update(0.2)).toEqual([]);
    expect(player.isComplete).toBe(true);
  });

  it("does not advance while paused", () => {
    const player = new ShowTimelinePlayer();
    player.play([cue("one", 1)], 2);
    player.pause();
    expect(player.update(1)).toEqual([]);
    expect(player.time).toBe(0);
    player.resume();
    expect(player.update(1).map((item) => item.id)).toEqual(["one"]);
  });

  it("can replay the same design in a fresh timeline", () => {
    const player = new ShowTimelinePlayer();
    const cues = [cue("repeatable", 0)];
    player.play(cues, 0.1);
    expect(player.update(0)).toHaveLength(1);
    player.play(cues, 0.1);
    expect(player.update(0)).toHaveLength(1);
  });
});
