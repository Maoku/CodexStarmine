import { PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";

import {
  ADVERTISE_CAMERA_CYCLE_SECONDS,
  ADVERTISE_CAMERA_PRESETS,
  AdvertiseCameraController,
  sampleAdvertiseCamera,
} from "./AdvertiseCameraController";

describe("AdvertiseCameraController", () => {
  it("loops smoothly through all safe title presets", () => {
    expect(ADVERTISE_CAMERA_PRESETS).toHaveLength(4);
    expect(sampleAdvertiseCamera(0).position.toArray()).toEqual(
      ADVERTISE_CAMERA_PRESETS[0].position,
    );
    expect(
      sampleAdvertiseCamera(ADVERTISE_CAMERA_CYCLE_SECONDS).position.toArray(),
    ).toEqual(ADVERTISE_CAMERA_PRESETS[0].position);
    expect(sampleAdvertiseCamera(3.5).position.toArray()).not.toEqual(
      ADVERTISE_CAMERA_PRESETS[0].position,
    );
  });

  it("keeps a fixed viewpoint when reduced motion is enabled", () => {
    const camera = new PerspectiveCamera();
    const controller = new AdvertiseCameraController(camera);
    controller.setReducedMotion(true);
    controller.setEnabled(true);
    const initialPosition = camera.position.toArray();
    const initialQuaternion = camera.quaternion.toArray();

    controller.update(20);
    expect(camera.position.toArray()).toEqual(initialPosition);
    expect(camera.quaternion.toArray()).toEqual(initialQuaternion);
  });

  it("does not move the camera while disabled", () => {
    const camera = new PerspectiveCamera();
    camera.position.set(1, 2, 3);
    const controller = new AdvertiseCameraController(camera);

    controller.update(1);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
  });
});
