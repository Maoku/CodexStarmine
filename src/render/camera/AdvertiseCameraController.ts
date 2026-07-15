import { MathUtils, Vector3, type PerspectiveCamera } from "three";

export const ADVERTISE_CAMERA_CYCLE_SECONDS = 28;

export interface AdvertiseCameraPreset {
  readonly fov: number;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export const ADVERTISE_CAMERA_PRESETS: readonly AdvertiseCameraPreset[] = [
  { fov: 58, position: [0, 15, 72], target: [0, 102, -150] },
  { fov: 64, position: [-62, 24, 48], target: [4, 110, -144] },
  { fov: 68, position: [92, 38, 74], target: [-8, 116, -150] },
  { fov: 72, position: [-118, 54, 105], target: [0, 122, -138] },
] as const;

export function sampleAdvertiseCamera(elapsedSeconds: number): {
  fov: number;
  position: Vector3;
  target: Vector3;
} {
  const cycle = MathUtils.euclideanModulo(
    elapsedSeconds,
    ADVERTISE_CAMERA_CYCLE_SECONDS,
  );
  const scaled =
    (cycle / ADVERTISE_CAMERA_CYCLE_SECONDS) * ADVERTISE_CAMERA_PRESETS.length;
  const fromIndex = Math.floor(scaled) % ADVERTISE_CAMERA_PRESETS.length;
  const toIndex = (fromIndex + 1) % ADVERTISE_CAMERA_PRESETS.length;
  const rawProgress = scaled - Math.floor(scaled);
  const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
  const from = ADVERTISE_CAMERA_PRESETS[fromIndex];
  const to = ADVERTISE_CAMERA_PRESETS[toIndex];
  return {
    fov: MathUtils.lerp(from.fov, to.fov, progress),
    position: new Vector3(...from.position).lerp(
      new Vector3(...to.position),
      progress,
    ),
    target: new Vector3(...from.target).lerp(
      new Vector3(...to.target),
      progress,
    ),
  };
}

export class AdvertiseCameraController {
  readonly #camera: PerspectiveCamera;
  #elapsedSeconds = 0;
  #enabled = false;
  #reducedMotion = false;

  constructor(camera: PerspectiveCamera) {
    this.#camera = camera;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (enabled) {
      this.#elapsedSeconds = 0;
      this.#apply(0);
    }
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.#reducedMotion = reducedMotion;
    if (this.#enabled && reducedMotion) this.#apply(0);
  }

  update(deltaSeconds: number): void {
    if (!this.#enabled || this.#reducedMotion) return;
    this.#elapsedSeconds += Math.min(Math.max(deltaSeconds, 0), 0.05);
    this.#apply(this.#elapsedSeconds);
  }

  #apply(elapsedSeconds: number): void {
    const sample = sampleAdvertiseCamera(elapsedSeconds);
    this.#camera.position.copy(sample.position);
    this.#camera.fov = sample.fov;
    this.#camera.lookAt(sample.target);
    this.#camera.updateProjectionMatrix();
  }
}
