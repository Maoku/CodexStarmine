import { Vector3, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  FREE_VIEW_PRESETS,
  HOME_FREE_VIEW_PRESET_ID,
  type FreeViewPreset,
  type FreeViewPresetId,
} from "../../modes/viewFree/viewPresets";

const KEYBOARD_MOVE_SPEED = 34;
const KEYBOARD_FAST_MULTIPLIER = 3;
const MOVEMENT_KEY_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export interface FreeViewKeyboardAxes {
  forward: number;
  right: number;
  up: number;
}

export function resolveFreeViewKeyboardAxes(
  pressedKeys: ReadonlySet<string>,
): FreeViewKeyboardAxes {
  const pressed = (...codes: string[]) =>
    codes.some((code) => pressedKeys.has(code));
  return {
    forward:
      Number(pressed("KeyW", "ArrowUp")) - Number(pressed("KeyS", "ArrowDown")),
    right:
      Number(pressed("KeyD", "ArrowRight")) -
      Number(pressed("KeyA", "ArrowLeft")),
    up: Number(pressed("KeyE")) - Number(pressed("KeyQ")),
  };
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export function applyFreeViewPreset(
  camera: PerspectiveCamera,
  target: Vector3,
  presetId: FreeViewPresetId,
): FreeViewPreset {
  const preset = FREE_VIEW_PRESETS[presetId];
  camera.position.set(...preset.position);
  camera.fov = preset.fov;
  camera.updateProjectionMatrix();
  target.set(...preset.target);
  return preset;
}

export class FreeViewCameraController {
  readonly #camera: PerspectiveCamera;
  readonly #controls: OrbitControls;
  readonly #domElement: HTMLElement;
  readonly #forward = new Vector3();
  readonly #movement = new Vector3();
  readonly #pressedKeys = new Set<string>();
  readonly #right = new Vector3();
  readonly #up = new Vector3();

  constructor(camera: PerspectiveCamera, domElement: HTMLElement) {
    this.#camera = camera;
    this.#domElement = domElement;
    this.#controls = new OrbitControls(camera, domElement);
    this.#controls.enabled = false;
    this.#controls.enableDamping = true;
    this.#controls.dampingFactor = 0.075;
    this.#controls.enablePan = true;
    this.#controls.screenSpacePanning = true;
    this.#controls.minDistance = 0.75;
    this.#controls.maxDistance = 680;
    this.#controls.minPolarAngle = 0.01;
    this.#controls.maxPolarAngle = Math.PI - 0.01;
    this.#controls.panSpeed = 0.85;
    this.#controls.rotateSpeed = 0.55;
    this.#controls.zoomSpeed = 0.9;
    this.#controls.zoomToCursor = true;
    this.#domElement.tabIndex = -1;
    this.#domElement.setAttribute(
      "aria-keyshortcuts",
      "W A S D Q E ArrowUp ArrowDown ArrowLeft ArrowRight",
    );
    window.addEventListener("keydown", this.#handleKeyDown);
    window.addEventListener("keyup", this.#handleKeyUp);
    window.addEventListener("blur", this.#clearPressedKeys);

    this.applyPreset(HOME_FREE_VIEW_PRESET_ID);
  }

  applyPreset(presetId: FreeViewPresetId): FreeViewPreset {
    const preset = applyFreeViewPreset(
      this.#camera,
      this.#controls.target,
      presetId,
    );
    this.#controls.update();
    return preset;
  }

  reset(): FreeViewPreset {
    return this.applyPreset(HOME_FREE_VIEW_PRESET_ID);
  }

  setEnabled(enabled: boolean): void {
    this.#controls.enabled = enabled;
    this.#domElement.tabIndex = enabled ? 0 : -1;
    this.#domElement.classList.toggle("night-sky-canvas--interactive", enabled);
    if (!enabled) this.#clearPressedKeys();
  }

  update(deltaSeconds: number): void {
    if (!this.#controls.enabled) return;
    this.#moveFromKeyboard(deltaSeconds);
    this.#controls.update();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.#handleKeyDown);
    window.removeEventListener("keyup", this.#handleKeyUp);
    window.removeEventListener("blur", this.#clearPressedKeys);
    this.#clearPressedKeys();
    this.#controls.dispose();
    this.#domElement.classList.remove("night-sky-canvas--interactive");
  }

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    const isMovementKey = MOVEMENT_KEY_CODES.has(event.code);
    const isShiftKey = event.code.startsWith("Shift");
    if (
      !this.#controls.enabled ||
      isEditableKeyboardTarget(event.target) ||
      (!isMovementKey && !isShiftKey)
    ) {
      return;
    }

    const isNewPress = !this.#pressedKeys.has(event.code);
    this.#pressedKeys.add(event.code);
    if (isMovementKey) event.preventDefault();
    if (isNewPress && isMovementKey) {
      this.#moveFromKeyboard(1 / 30);
      this.#controls.update();
    }
  };

  readonly #handleKeyUp = (event: KeyboardEvent): void => {
    this.#pressedKeys.delete(event.code);
  };

  readonly #clearPressedKeys = (): void => {
    this.#pressedKeys.clear();
  };

  #moveFromKeyboard(deltaSeconds: number): void {
    const axes = resolveFreeViewKeyboardAxes(this.#pressedKeys);
    if (axes.forward === 0 && axes.right === 0 && axes.up === 0) return;

    this.#camera.getWorldDirection(this.#forward);
    this.#right.crossVectors(this.#forward, this.#camera.up);
    if (this.#right.lengthSq() < 0.000001) {
      this.#right.setFromMatrixColumn(this.#camera.matrixWorld, 0);
    }
    this.#right.normalize();
    this.#up.copy(this.#camera.up).normalize();

    this.#movement
      .set(0, 0, 0)
      .addScaledVector(this.#forward, axes.forward)
      .addScaledVector(this.#right, axes.right)
      .addScaledVector(this.#up, axes.up);
    if (this.#movement.lengthSq() > 1) this.#movement.normalize();

    const fast =
      this.#pressedKeys.has("ShiftLeft") || this.#pressedKeys.has("ShiftRight");
    const distance =
      KEYBOARD_MOVE_SPEED *
      (fast ? KEYBOARD_FAST_MULTIPLIER : 1) *
      Math.min(Math.max(deltaSeconds, 0), 0.05);
    this.#movement.multiplyScalar(distance);
    this.#camera.position.add(this.#movement);
    this.#controls.target.add(this.#movement);
  }
}
