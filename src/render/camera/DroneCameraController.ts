import { MathUtils, Vector3, type PerspectiveCamera } from "three";

export const DRONE_CAMERA_ENTRY_SECONDS = 4;
export const DRONE_CAMERA_HOLD_SECONDS = 3;
export const DRONE_CAMERA_MOVE_SECONDS = 7;

interface DroneCameraShot {
  readonly angleDegrees: number;
  readonly fov: number;
  readonly height: number;
  readonly radius: number;
  readonly target: readonly [number, number, number];
  readonly transition?: "fly-through" | "orbit";
}

export interface DroneCameraSample {
  readonly fov: number;
  readonly phase: "fly-through" | "holding" | "moving";
  readonly position: Vector3;
  readonly shotIndex: number;
  readonly target: Vector3;
}

const DRONE_ORBIT_CENTER = new Vector3(0, 128, -112);
const DRONE_FLY_THROUGH_POINT = new Vector3(0, 118, -112);
export const DRONE_FLY_THROUGH_SHOT_INDEX = 2;

export const DRONE_CAMERA_SHOTS: readonly DroneCameraShot[] = [
  {
    angleDegrees: 0,
    fov: 56,
    height: 38,
    radius: 190,
    target: [0, 118, -112],
  },
  {
    angleDegrees: 72,
    fov: 61,
    height: 62,
    radius: 162,
    target: [8, 128, -112],
  },
  {
    angleDegrees: 148,
    fov: 68,
    height: 112,
    radius: 136,
    target: [0, 138, -112],
    transition: "fly-through",
  },
  {
    angleDegrees: 228,
    fov: 62,
    height: 78,
    radius: 150,
    target: [-8, 130, -112],
  },
  {
    angleDegrees: 306,
    fov: 58,
    height: 52,
    radius: 180,
    target: [0, 122, -112],
  },
] as const;

const DRONE_CAMERA_SHOT_SECONDS =
  DRONE_CAMERA_HOLD_SECONDS + DRONE_CAMERA_MOVE_SECONDS;

export const DRONE_CAMERA_CYCLE_SECONDS =
  DRONE_CAMERA_SHOTS.length * DRONE_CAMERA_SHOT_SECONDS;

/** Quintic easing keeps velocity and acceleration at zero at both endpoints. */
export function easeDroneCameraPath(progress: number): number {
  const value = MathUtils.clamp(progress, 0, 1);
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function positionAt(
  angleDegrees: number,
  radius: number,
  height: number,
): Vector3 {
  const angle = MathUtils.degToRad(angleDegrees);
  return new Vector3(
    DRONE_ORBIT_CENTER.x + Math.sin(angle) * radius,
    height,
    DRONE_ORBIT_CENTER.z + Math.cos(angle) * radius,
  );
}

function quadraticBezierThrough(
  from: Vector3,
  through: Vector3,
  to: Vector3,
  progress: number,
): Vector3 {
  const control = through
    .clone()
    .multiplyScalar(2)
    .sub(from.clone().add(to).multiplyScalar(0.5));
  const inverse = 1 - progress;
  return from
    .clone()
    .multiplyScalar(inverse * inverse)
    .addScaledVector(control, 2 * inverse * progress)
    .addScaledVector(to, progress * progress);
}

export function sampleDroneCamera(elapsedSeconds: number): DroneCameraSample {
  const cycle = MathUtils.euclideanModulo(
    elapsedSeconds,
    DRONE_CAMERA_CYCLE_SECONDS,
  );
  const shotIndex =
    Math.floor(cycle / DRONE_CAMERA_SHOT_SECONDS) % DRONE_CAMERA_SHOTS.length;
  const localSeconds = cycle - shotIndex * DRONE_CAMERA_SHOT_SECONDS;
  const from = DRONE_CAMERA_SHOTS[shotIndex];
  const nextIndex = (shotIndex + 1) % DRONE_CAMERA_SHOTS.length;
  const to = DRONE_CAMERA_SHOTS[nextIndex];

  if (localSeconds < DRONE_CAMERA_HOLD_SECONDS) {
    return {
      fov: from.fov,
      phase: "holding",
      position: positionAt(from.angleDegrees, from.radius, from.height),
      shotIndex,
      target: new Vector3(...from.target),
    };
  }

  const rawProgress =
    (localSeconds - DRONE_CAMERA_HOLD_SECONDS) / DRONE_CAMERA_MOVE_SECONDS;
  const progress = easeDroneCameraPath(rawProgress);
  const toAngle = nextIndex === 0 ? to.angleDegrees + 360 : to.angleDegrees;
  const fromPosition = positionAt(from.angleDegrees, from.radius, from.height);
  const toPosition = positionAt(toAngle, to.radius, to.height);
  const flyThrough = from.transition === "fly-through";
  const flyThroughEnvelope = flyThrough ? Math.sin(Math.PI * progress) ** 2 : 0;
  const target = new Vector3(...from.target).lerp(
    new Vector3(...to.target),
    progress,
  );
  target.y += flyThroughEnvelope * 30;
  return {
    fov: MathUtils.lerp(from.fov, to.fov, progress) + flyThroughEnvelope * 10,
    phase: flyThrough ? "fly-through" : "moving",
    position: flyThrough
      ? quadraticBezierThrough(
          fromPosition,
          DRONE_FLY_THROUGH_POINT,
          toPosition,
          progress,
        )
      : positionAt(
          MathUtils.lerp(from.angleDegrees, toAngle, progress),
          MathUtils.lerp(from.radius, to.radius, progress),
          MathUtils.lerp(from.height, to.height, progress),
        ),
    shotIndex,
    target,
  };
}

export class DroneCameraController {
  readonly #camera: PerspectiveCamera;
  readonly #currentTarget = new Vector3(...DRONE_CAMERA_SHOTS[0].target);
  readonly #entryPosition = new Vector3();
  readonly #entryTarget = new Vector3();
  readonly #forward = new Vector3();
  #enabled = false;
  #entryElapsedSeconds = 0;
  #entryFov = 60;
  #pathElapsedSeconds = 0;
  #reducedMotion = false;

  constructor(camera: PerspectiveCamera) {
    this.#camera = camera;
  }

  get isEnabled(): boolean {
    return this.#enabled;
  }

  get target(): Vector3 {
    return this.#currentTarget.clone();
  }

  setEnabled(enabled: boolean, entryTarget?: Vector3): void {
    if (enabled === this.#enabled) return;
    this.#enabled = enabled;
    if (enabled) this.restart(entryTarget);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.#reducedMotion = reducedMotion;
  }

  restart(entryTarget?: Vector3): void {
    this.#entryElapsedSeconds = 0;
    this.#pathElapsedSeconds = 0;
    this.#entryPosition.copy(this.#camera.position);
    this.#entryFov = this.#camera.fov;
    if (entryTarget) {
      this.#entryTarget.copy(entryTarget);
    } else {
      this.#camera.getWorldDirection(this.#forward);
      this.#entryTarget
        .copy(this.#camera.position)
        .addScaledVector(this.#forward, 180);
    }
    this.#currentTarget.copy(this.#entryTarget);
  }

  update(deltaSeconds: number): void {
    if (!this.#enabled || this.#reducedMotion) return;
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
    if (this.#entryElapsedSeconds < DRONE_CAMERA_ENTRY_SECONDS) {
      this.#entryElapsedSeconds = Math.min(
        this.#entryElapsedSeconds + delta,
        DRONE_CAMERA_ENTRY_SECONDS,
      );
      const progress = easeDroneCameraPath(
        this.#entryElapsedSeconds / DRONE_CAMERA_ENTRY_SECONDS,
      );
      const firstShot = sampleDroneCamera(0);
      this.#camera.position
        .copy(this.#entryPosition)
        .lerp(firstShot.position, progress);
      this.#currentTarget
        .copy(this.#entryTarget)
        .lerp(firstShot.target, progress);
      this.#camera.fov = MathUtils.lerp(
        this.#entryFov,
        firstShot.fov,
        progress,
      );
      this.#applyTarget();
      return;
    }

    this.#pathElapsedSeconds += delta;
    const sample = sampleDroneCamera(this.#pathElapsedSeconds);
    this.#camera.position.copy(sample.position);
    this.#currentTarget.copy(sample.target);
    this.#camera.fov = sample.fov;
    this.#applyTarget();
  }

  #applyTarget(): void {
    this.#camera.lookAt(this.#currentTarget);
    this.#camera.updateProjectionMatrix();
  }
}
