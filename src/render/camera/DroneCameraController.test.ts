import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  DRONE_CAMERA_CYCLE_SECONDS,
  DRONE_CAMERA_HOLD_SECONDS,
  DRONE_CAMERA_MOVE_SECONDS,
  DRONE_CAMERA_SHOTS,
  DRONE_FLY_THROUGH_SHOT_INDEX,
  DroneCameraController,
  easeDroneCameraPath,
  sampleDroneCamera,
} from "./DroneCameraController";

describe("drone camera path", () => {
  it("loops around every shot without a position jump", () => {
    expect(DRONE_CAMERA_SHOTS).toHaveLength(5);
    const start = sampleDroneCamera(0);
    const end = sampleDroneCamera(DRONE_CAMERA_CYCLE_SECONDS);

    expect(end.position.toArray()).toEqual(start.position.toArray());
    expect(end.target.toArray()).toEqual(start.target.toArray());
    expect(end.fov).toBe(start.fov);
  });

  it("alternates fixed shots and eased orbit movement", () => {
    const firstHold = sampleDroneCamera(0.4);
    const lastHold = sampleDroneCamera(DRONE_CAMERA_HOLD_SECONDS - 0.1);
    const moving = sampleDroneCamera(DRONE_CAMERA_HOLD_SECONDS + 1);

    expect(firstHold.phase).toBe("holding");
    expect(lastHold.position.toArray()).toEqual(firstHold.position.toArray());
    expect(moving.phase).toBe("moving");
    expect(moving.position.toArray()).not.toEqual(firstHold.position.toArray());
  });

  it("arrives with near-zero movement at both ends of a camera move", () => {
    const epsilon = 0.001;
    const moveStart = DRONE_CAMERA_HOLD_SECONDS;
    const moveEnd = moveStart + DRONE_CAMERA_MOVE_SECONDS;
    const beforeStart = sampleDroneCamera(moveStart - epsilon);
    const afterStart = sampleDroneCamera(moveStart + epsilon);
    const beforeEnd = sampleDroneCamera(moveEnd - epsilon);
    const afterEnd = sampleDroneCamera(moveEnd + epsilon);

    expect(beforeStart.position.distanceTo(afterStart.position)).toBeLessThan(
      0.001,
    );
    expect(beforeEnd.position.distanceTo(afterEnd.position)).toBeLessThan(
      0.001,
    );
    expect(easeDroneCameraPath(0)).toBe(0);
    expect(easeDroneCameraPath(1)).toBe(1);
  });

  it("flies through the lower center of the burst without crossing its look target", () => {
    const flyThroughMidpoint =
      DRONE_FLY_THROUGH_SHOT_INDEX *
        (DRONE_CAMERA_HOLD_SECONDS + DRONE_CAMERA_MOVE_SECONDS) +
      DRONE_CAMERA_HOLD_SECONDS +
      DRONE_CAMERA_MOVE_SECONDS / 2;
    const sample = sampleDroneCamera(flyThroughMidpoint);

    expect(sample.phase).toBe("fly-through");
    expect(sample.position.distanceTo(new Vector3(0, 118, -112))).toBeLessThan(
      0.001,
    );
    expect(sample.target.y - sample.position.y).toBeGreaterThan(35);
    expect(sample.fov).toBeGreaterThan(70);
  });
});

describe("DroneCameraController", () => {
  it("leaves the camera untouched while disabled", () => {
    const camera = new PerspectiveCamera();
    camera.position.set(1, 2, 3);
    const controller = new DroneCameraController(camera);

    controller.update(12);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
  });

  it("enters the first shot from the current presentation without jumping", () => {
    const camera = new PerspectiveCamera();
    camera.position.set(4, 20, 80);
    camera.lookAt(new Vector3(0, 120, -112));
    const controller = new DroneCameraController(camera);
    const initial = camera.position.clone();

    controller.setEnabled(true, new Vector3(0, 120, -112));
    expect(camera.position.toArray()).toEqual(initial.toArray());

    controller.update(0.05);
    expect(camera.position.distanceTo(initial)).toBeLessThan(0.01);
    expect(camera.position.toArray()).not.toEqual(initial.toArray());
  });

  it("keeps a fixed viewpoint when reduced motion is requested", () => {
    const camera = new PerspectiveCamera();
    camera.position.set(4, 20, 80);
    const controller = new DroneCameraController(camera);
    controller.setReducedMotion(true);
    controller.setEnabled(true);

    controller.update(20);
    expect(camera.position.toArray()).toEqual([4, 20, 80]);
  });
});
