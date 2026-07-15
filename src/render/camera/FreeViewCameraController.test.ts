import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  FREE_VIEW_PRESET_IDS,
  FREE_VIEW_PRESETS,
  isFreeViewPresetId,
} from "../../modes/viewFree/viewPresets";
import {
  applyFreeViewPreset,
  resolveFreeViewKeyboardAxes,
} from "./FreeViewCameraController";

describe("free-view camera presets", () => {
  it("applies every preset to the camera and orbit target", () => {
    for (const presetId of FREE_VIEW_PRESET_IDS) {
      const camera = new PerspectiveCamera();
      const target = new Vector3();
      const preset = applyFreeViewPreset(camera, target, presetId);

      expect(camera.position.toArray()).toEqual([...preset.position]);
      expect(target.toArray()).toEqual([...preset.target]);
      expect(camera.fov).toBe(preset.fov);
    }
  });

  it("places the inside preset at the central burst altitude", () => {
    const inside = FREE_VIEW_PRESETS["inside-burst"];
    expect(inside.position).toEqual([0, 142, -112]);
    expect(inside.target[2]).toBeLessThan(inside.position[2]);
  });

  it("rejects unknown preset identifiers", () => {
    expect(isFreeViewPresetId("wide")).toBe(true);
    expect(isFreeViewPresetId("moon")).toBe(false);
  });

  it("maps WASD, arrows, and vertical keys to movement axes", () => {
    expect(
      resolveFreeViewKeyboardAxes(new Set(["KeyW", "KeyD", "KeyE"])),
    ).toEqual({ forward: 1, right: 1, up: 1 });
    expect(
      resolveFreeViewKeyboardAxes(new Set(["ArrowDown", "ArrowLeft", "KeyQ"])),
    ).toEqual({ forward: -1, right: -1, up: -1 });
  });

  it("cancels opposing keyboard movement", () => {
    expect(
      resolveFreeViewKeyboardAxes(
        new Set(["KeyW", "KeyS", "ArrowLeft", "ArrowRight", "KeyQ", "KeyE"]),
      ),
    ).toEqual({ forward: 0, right: 0, up: 0 });
  });
});
