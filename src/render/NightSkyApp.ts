import {
  NoToneMapping,
  SRGBColorSpace,
  WebGLRenderer,
  type PerspectiveCamera,
  type Scene,
} from "three";

import { clampPixelRatio } from "../core/env";
import { createPhaseStatus } from "../ui/createPhaseStatus";
import { createNightSkyScene } from "./scene/createNightSkyScene";

export class NightSkyApp {
  readonly #camera: PerspectiveCamera;
  readonly #host: HTMLElement;
  readonly #renderer: WebGLRenderer;
  readonly #scene: Scene;
  #isRunning = false;

  constructor(host: HTMLElement) {
    this.#host = host;

    const size = this.#measure();
    const nightSky = createNightSkyScene(size.width / size.height);
    this.#camera = nightSky.camera;
    this.#scene = nightSky.scene;

    this.#renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.#renderer.domElement.className = "night-sky-canvas";
    this.#renderer.domElement.setAttribute("role", "img");
    this.#renderer.domElement.setAttribute(
      "aria-label",
      "花火の打ち上げを待つ静かな夜空",
    );
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.toneMapping = NoToneMapping;
    this.#renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
    this.#renderer.setSize(size.width, size.height, false);

    this.#host.replaceChildren(
      this.#renderer.domElement,
      createPhaseStatus(this.#renderer.capabilities.isWebGL2),
    );
  }

  start(): void {
    if (this.#isRunning) {
      return;
    }

    this.#isRunning = true;
    window.addEventListener("resize", this.#resize);
    this.#render();
  }

  destroy(): void {
    if (!this.#isRunning) {
      return;
    }

    this.#isRunning = false;
    window.removeEventListener("resize", this.#resize);
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  readonly #measure = (): { height: number; width: number } => ({
    height: Math.max(this.#host.clientHeight, 1),
    width: Math.max(this.#host.clientWidth, 1),
  });

  readonly #render = (): void => {
    this.#renderer.render(this.#scene, this.#camera);
  };

  readonly #resize = (): void => {
    const size = this.#measure();
    this.#camera.aspect = size.width / size.height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
    this.#renderer.setSize(size.width, size.height, false);
    this.#render();
  };
}
