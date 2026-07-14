import {
  ACESFilmicToneMapping,
  Clock,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type PerspectiveCamera,
  type Scene,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { Vector2 } from "three";

import { FireworkAudio } from "../audio";
import { clampPixelRatio } from "../core/env";
import {
  DesignRepository,
  FIREWORK_PRESETS,
  resolveSizePreset,
  withSizeClass,
  type FireworkDesign,
  type SizeClass,
} from "../data";
import { CraftController } from "../modes/craft";
import { AppShell, type AppMode } from "../ui/AppShell";
import { FireworkSystem } from "./fx";
import { createNightSkyScene } from "./scene/createNightSkyScene";

export class NightSkyApp {
  readonly #audio: FireworkAudio;
  readonly #camera: PerspectiveCamera;
  readonly #clock = new Clock();
  readonly #composer: EffectComposer;
  readonly #fireworks: FireworkSystem;
  readonly #host: HTMLElement;
  readonly #renderer: WebGLRenderer;
  readonly #scene: Scene;
  readonly #ui: AppShell;
  readonly #updateScene: (elapsedSeconds: number) => void;
  #animationFrame = 0;
  #demoIndex = 0;
  #isRunning = false;
  #isFreeRunning = true;
  #mode: AppMode = "craft";
  #nextDemoLaunch = 0.85;

  constructor(host: HTMLElement) {
    this.#host = host;

    const size = this.#measure();
    const nightSky = createNightSkyScene(size.width / size.height);
    this.#camera = nightSky.camera;
    this.#scene = nightSky.scene;
    this.#updateScene = nightSky.update;
    this.#audio = new FireworkAudio();
    this.#fireworks = new FireworkSystem(this.#scene, {
      onBurst: (position, design) => {
        this.#audio.playBurst(position, design);
        const stage = design.colorStages[1] ?? design.colorStages[0];
        const size = resolveSizePreset(design.sizeClass);
        nightSky.flash(
          new Vector3(position.x, position.y, position.z),
          stage?.color ?? 0xffffff,
          (stage?.intensity ?? 1) * size.pointScale,
        );
      },
      onLaunch: (design) => this.#audio.playLaunch(design),
    });

    this.#renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.#renderer.domElement.className = "night-sky-canvas";
    this.#renderer.domElement.setAttribute("role", "img");
    this.#renderer.domElement.setAttribute(
      "aria-label",
      "月明かりの湖畔で自作花火を鑑賞するシーン",
    );
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.toneMapping = ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 0.9;
    this.#renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
    this.#renderer.setSize(size.width, size.height, false);

    this.#composer = new EffectComposer(this.#renderer);
    this.#composer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
    this.#composer.addPass(new RenderPass(this.#scene, this.#camera));
    this.#composer.addPass(
      new UnrealBloomPass(
        new Vector2(size.width, size.height),
        0.82,
        0.6,
        0.72,
      ),
    );
    this.#composer.addPass(new OutputPass());

    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    const repository = new DesignRepository(storage);
    const craft = new CraftController(repository);
    this.#ui = new AppShell(craft, {
      onAudioPhysicality: (value) => {
        this.#audio.physicality = value;
      },
      onDesignLibraryChange: () => undefined,
      onModeChange: (mode) => {
        this.#mode = mode;
        if (mode === "free") {
          this.#nextDemoLaunch = this.#clock.elapsedTime + 0.4;
          this.#ui.setFreeState(
            true,
            "湖畔の序章",
            "プリセットから演目を構成中",
          );
        }
      },
      onPreview: (design) => {
        this.#fireworks.launch(design, { lane: 0, seed: Date.now() });
      },
      onFreeToggle: () => {
        this.#isFreeRunning = !this.#isFreeRunning;
        this.#ui.setFreeState(
          this.#isFreeRunning,
          "湖畔の序章",
          this.#isFreeRunning ? "自動演出を再生中" : "余韻を残して一時停止中",
        );
      },
    });
    this.#host.replaceChildren(this.#renderer.domElement, this.#ui.element);
  }

  start(): void {
    if (this.#isRunning) return;
    this.#isRunning = true;
    this.#clock.start();
    window.addEventListener("resize", this.#resize);
    window.addEventListener("pointerdown", this.#unlockAudio, { once: true });
    window.addEventListener("keydown", this.#unlockAudio, { once: true });
    this.#animationFrame = window.requestAnimationFrame(this.#render);
  }

  destroy(): void {
    if (!this.#isRunning) return;
    this.#isRunning = false;
    window.cancelAnimationFrame(this.#animationFrame);
    window.removeEventListener("resize", this.#resize);
    window.removeEventListener("pointerdown", this.#unlockAudio);
    window.removeEventListener("keydown", this.#unlockAudio);
    void this.#audio.dispose();
    this.#ui.destroy();
    this.#fireworks.dispose();
    this.#composer.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  readonly #measure = (): { height: number; width: number } => ({
    height: Math.max(this.#host.clientHeight, 1),
    width: Math.max(this.#host.clientWidth, 1),
  });

  readonly #launchDemo = (): void => {
    const sizes: SizeClass[] = ["small", "medium", "large"];
    const preset = FIREWORK_PRESETS[this.#demoIndex % FIREWORK_PRESETS.length];
    const size =
      sizes[
        Math.floor(this.#demoIndex / FIREWORK_PRESETS.length) % sizes.length
      ];
    const design: FireworkDesign = withSizeClass(preset, size);
    this.#fireworks.launch(design, {
      lane: [-0.62, 0, 0.62][this.#demoIndex % 3],
      seed: 2_026 + this.#demoIndex * 101,
    });
    this.#demoIndex += 1;
  };

  readonly #render = (): void => {
    if (!this.#isRunning) return;
    const delta = Math.min(this.#clock.getDelta(), 0.05);
    const elapsed = this.#clock.elapsedTime;
    if (
      this.#mode === "free" &&
      this.#isFreeRunning &&
      elapsed >= this.#nextDemoLaunch
    ) {
      this.#launchDemo();
      this.#nextDemoLaunch =
        elapsed + (this.#fireworks.activeCount > 1_400 ? 5.8 : 4.2);
    }
    this.#fireworks.update(delta);
    this.#updateScene(elapsed);
    this.#composer.render();
    this.#animationFrame = window.requestAnimationFrame(this.#render);
  };

  readonly #unlockAudio = (): void => {
    void this.#audio.unlock();
  };

  readonly #resize = (): void => {
    const size = this.#measure();
    const pixelRatio = clampPixelRatio(window.devicePixelRatio);
    this.#camera.aspect = size.width / size.height;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setPixelRatio(pixelRatio);
    this.#renderer.setSize(size.width, size.height, false);
    this.#composer.setPixelRatio(pixelRatio);
    this.#composer.setSize(size.width, size.height);
  };
}
