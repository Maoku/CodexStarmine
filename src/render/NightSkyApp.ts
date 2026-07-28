import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Timer,
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

import { FireworkAudio, loadAudioVolume, saveAudioVolume } from "../audio";
import { BackgroundRuntimeController } from "../app/BackgroundRuntimeController";
import type { BackgroundRuntime } from "../app/renewalContracts";
import { clampPixelRatio } from "../core/env";
import {
  DesignRepository,
  FIREWORK_PRESETS,
  resolveCurrentIntent,
  resolveSizePreset,
  type AnyFireworkDesign,
  type ShowCue,
} from "../data";
import { SingleLoopCheckController } from "../modes/check";
import { CraftController } from "../modes/craft";
import {
  AdvertiseDemoController,
  FreeShowController,
  HOME_FREE_VIEW_PRESET_ID,
} from "../modes/viewFree";
import { AppShell } from "../ui/AppShell";
import type { ViewerCameraMode } from "../ui/viewer";
import type { Locale } from "../i18n";
import { text } from "../i18n";
import {
  AdvertiseCameraController,
  DroneCameraController,
  FreeViewCameraController,
} from "./camera";
import { FireworkSystem } from "./fx";
import { prepareShowLaunch } from "./prepareShowLaunch";
import {
  createNightSkyScene,
  NIGHT_SCENE_ACCESSIBLE_LABEL,
} from "./scene/createNightSkyScene";

export class NightSkyApp {
  readonly #advertiseCamera: AdvertiseCameraController;
  readonly #advertiseDemo: AdvertiseDemoController;
  readonly #audio: FireworkAudio;
  readonly #backgroundRuntime: BackgroundRuntimeController;
  readonly #camera: PerspectiveCamera;
  readonly #check: SingleLoopCheckController;
  readonly #composer: EffectComposer;
  readonly #droneCamera: DroneCameraController;
  readonly #fireworks: FireworkSystem;
  readonly #freeShow: FreeShowController;
  readonly #freeView: FreeViewCameraController;
  readonly #host: HTMLElement;
  readonly #renderer: WebGLRenderer;
  readonly #reducedMotionQuery: MediaQueryList;
  readonly #scene: Scene;
  readonly #timer = new Timer();
  readonly #ui: AppShell;
  readonly #updateScene: (elapsedSeconds: number) => void;
  #animationFrame = 0;
  #backgroundRuntimeKind: BackgroundRuntime = "none";
  #isRunning = false;
  #isUiReady = false;
  #pendingRuntime?: {
    design?: AnyFireworkDesign;
    runtime: BackgroundRuntime;
  };
  #viewerCameraAvailable = false;
  #viewerCameraMode: ViewerCameraMode = "manual";

  constructor(host: HTMLElement, locale: Locale = "ja") {
    this.#host = host;
    this.#timer.connect(document);

    const size = this.#measure();
    const nightSky = createNightSkyScene(
      size.width / size.height,
      window.devicePixelRatio,
    );
    this.#camera = nightSky.camera;
    this.#scene = nightSky.scene;
    this.#updateScene = nightSky.update;
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    const audioVolume = loadAudioVolume(storage);
    this.#audio = new FireworkAudio(audioVolume);
    this.#fireworks = new FireworkSystem(this.#scene, {
      onBurst: (position, design, plan) => {
        if (this.#backgroundRuntimeKind !== "advertise") {
          this.#audio.playBurst(position, design, plan);
        }
        const stage = design.colorStages[1] ?? design.colorStages[0];
        const size = resolveSizePreset(design.sizeClass);
        nightSky.flash(
          new Vector3(position.x, position.y, position.z),
          stage?.color ?? 0xffffff,
          (stage?.intensity ?? 1) * size.pointScale,
        );
      },
      onLaunch: (position, design, plan) => {
        if (this.#backgroundRuntimeKind !== "advertise") {
          this.#audio.playLaunch(position, design, plan);
        }
      },
    });

    this.#renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.#renderer.domElement.className = "night-sky-canvas";
    this.#renderer.domElement.setAttribute("role", "img");
    this.#renderer.domElement.setAttribute(
      "aria-label",
      locale === "ja"
        ? NIGHT_SCENE_ACCESSIBLE_LABEL
        : text(locale, "sceneLabel"),
    );
    this.#renderer.outputColorSpace = SRGBColorSpace;
    this.#renderer.toneMapping = ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 0.9;
    this.#renderer.setPixelRatio(clampPixelRatio(window.devicePixelRatio));
    this.#renderer.setSize(size.width, size.height, false);
    this.#freeView = new FreeViewCameraController(
      this.#camera,
      this.#renderer.domElement,
    );
    this.#droneCamera = new DroneCameraController(this.#camera);
    this.#advertiseCamera = new AdvertiseCameraController(this.#camera);
    this.#reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

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

    const repository = new DesignRepository(storage);
    const craft = new CraftController(repository);
    const getDesigns = () => [...FIREWORK_PRESETS, ...repository.list()];
    const launchShowCue = (cue: ShowCue, seed: number): void => {
      const source =
        repository.findIntent(cue.fireworkDesignID) ??
        FIREWORK_PRESETS.find(
          (candidate) => candidate.id === cue.fireworkDesignID,
        );
      if (!source) return;
      const launch = prepareShowLaunch(source, cue.sizePreset, seed);
      this.#fireworks.launch(launch.design, {
        compiledPlan: launch.compiledPlan,
        lane: cue.launcherLane,
        launchAngle: cue.launchAngle,
        seed,
        targetHeight: cue.targetHeight,
      });
    };
    this.#check = new SingleLoopCheckController({
      onLaunch: (intentDesign, seed, plan) => {
        const design =
          intentDesign.schemaVersion === 4
            ? resolveCurrentIntent(intentDesign)
            : intentDesign;
        this.#fireworks.launch(design, {
          compiledPlan: plan,
          lane: 0,
          launchAngle: 0,
          seed,
          targetHeight: resolveSizePreset(design.sizeClass).targetHeight,
        });
      },
      onState: (state) => this.#ui.setCheckState(state),
    });
    this.#freeShow = new FreeShowController({
      getDesigns,
      onCue: (cue) => {
        launchShowCue(cue, Math.floor(cue.time * 10_000) + cue.id.length * 97);
      },
      onState: (state) => {
        this.#ui.setFreeState(state);
      },
    });
    this.#advertiseDemo = new AdvertiseDemoController({
      getDesigns,
      onCue: (cue) => {
        launchShowCue(cue, Math.floor(cue.time * 8_000) + cue.id.length * 131);
      },
    });
    this.#advertiseDemo.setPageVisible(document.visibilityState === "visible");
    this.#advertiseDemo.setReducedMotion(this.#reducedMotionQuery.matches);
    this.#advertiseCamera.setReducedMotion(this.#reducedMotionQuery.matches);
    this.#droneCamera.setReducedMotion(this.#reducedMotionQuery.matches);
    this.#backgroundRuntime = new BackgroundRuntimeController({
      clearScene: () => this.#fireworks.clear(),
      setFreeViewEnabled: (enabled) => {
        this.#viewerCameraAvailable = enabled;
        this.#syncViewerCameraMode();
      },
      startAdvertise: () => {
        this.#advertiseCamera.setEnabled(true);
        this.#advertiseDemo.start();
      },
      startCheck: (design) => {
        this.#advertiseCamera.setEnabled(false);
        this.#freeView.reset();
        if (this.#droneCamera.isEnabled) {
          this.#droneCamera.restart(this.#freeView.target);
        }
        this.#ui.setFreeViewPreset(HOME_FREE_VIEW_PRESET_ID);
        this.#check.start(design);
      },
      startFree: () => {
        this.#advertiseCamera.setEnabled(false);
        this.#freeView.reset();
        if (this.#droneCamera.isEnabled) {
          this.#droneCamera.restart(this.#freeView.target);
        }
        this.#ui.setFreeViewPreset(HOME_FREE_VIEW_PRESET_ID);
        this.#freeShow.start();
      },
      stopAdvertise: () => {
        this.#advertiseDemo.stop();
        this.#advertiseCamera.setEnabled(false);
      },
      stopCheck: () => this.#check.stop(),
      stopFree: () => {
        this.#freeShow.stop();
      },
    });
    this.#ui = new AppShell(
      craft,
      {
        onAudioPhysicality: (value) => {
          this.#audio.physicality = value;
        },
        onAudioVolume: (value) => {
          this.#audio.volume = value;
          saveAudioVolume(storage, value);
        },
        onCheckLoopChange: (enabled) => this.#check.setLoopEnabled(enabled),
        onCheckToggle: () => this.#check.toggle(),
        onDesignLibraryChange: () => undefined,
        onFreeDensityChange: (value) => this.#freeShow.setDensity(value),
        onBackgroundRuntimeChange: (runtime, design) => {
          if (!this.#isUiReady) {
            this.#pendingRuntime = { runtime, design };
            return;
          }
          this.#setBackgroundRuntime(runtime, design);
        },
        onFreeToggle: () => this.#freeShow.toggle(),
        onFreeViewPresetChange: (presetId) => {
          this.#freeView.applyPreset(presetId);
        },
        onFreeViewReset: () => {
          this.#freeView.reset();
          this.#ui.setFreeViewPreset(HOME_FREE_VIEW_PRESET_ID);
        },
        onViewerCameraModeChange: (mode) => {
          this.#viewerCameraMode = mode;
          this.#syncViewerCameraMode();
        },
      },
      locale,
      audioVolume,
    );
    this.#isUiReady = true;
    if (this.#pendingRuntime) {
      this.#setBackgroundRuntime(
        this.#pendingRuntime.runtime,
        this.#pendingRuntime.design,
      );
      this.#pendingRuntime = undefined;
    }
    this.#host.replaceChildren(this.#renderer.domElement, this.#ui.element);
  }

  start(): void {
    if (this.#isRunning) return;
    this.#isRunning = true;
    window.addEventListener("resize", this.#resize);
    document.addEventListener("visibilitychange", this.#handleVisibilityChange);
    this.#reducedMotionQuery.addEventListener(
      "change",
      this.#handleReducedMotionChange,
    );
    window.addEventListener("pointerdown", this.#unlockAudio, { once: true });
    window.addEventListener("keydown", this.#unlockAudio, { once: true });
    this.#animationFrame = window.requestAnimationFrame(this.#render);
  }

  destroy(): void {
    if (!this.#isRunning) return;
    this.#isRunning = false;
    window.cancelAnimationFrame(this.#animationFrame);
    window.removeEventListener("resize", this.#resize);
    document.removeEventListener(
      "visibilitychange",
      this.#handleVisibilityChange,
    );
    this.#reducedMotionQuery.removeEventListener(
      "change",
      this.#handleReducedMotionChange,
    );
    window.removeEventListener("pointerdown", this.#unlockAudio);
    window.removeEventListener("keydown", this.#unlockAudio);
    void this.#audio.dispose();
    this.#timer.dispose();
    this.#check.stop();
    this.#advertiseDemo.stop();
    this.#advertiseCamera.setEnabled(false);
    this.#droneCamera.setEnabled(false);
    this.#freeShow.stop();
    this.#ui.destroy();
    this.#freeView.dispose();
    this.#fireworks.dispose();
    this.#composer.dispose();
    this.#renderer.dispose();
    this.#renderer.domElement.remove();
  }

  readonly #measure = (): { height: number; width: number } => ({
    height: Math.max(this.#host.clientHeight, 1),
    width: Math.max(this.#host.clientWidth, 1),
  });

  readonly #render = (timestamp: number): void => {
    if (!this.#isRunning) return;
    this.#timer.update(timestamp);
    const delta = Math.min(this.#timer.getDelta(), 0.05);
    const elapsed = this.#timer.getElapsed();
    this.#check.update(delta);
    this.#advertiseDemo.update(delta);
    this.#freeShow.update(delta);
    this.#fireworks.setRenderContext({
      cameraPosition: {
        x: this.#camera.position.x,
        y: this.#camera.position.y,
        z: this.#camera.position.z,
      },
      hardwareConcurrency: navigator.hardwareConcurrency || 8,
      pixelRatio: clampPixelRatio(window.devicePixelRatio),
      viewportHeight: Math.max(this.#host.clientHeight, 1),
    });
    this.#fireworks.update(delta);
    this.#updateScene(elapsed);
    this.#freeView.update(delta);
    this.#droneCamera.update(delta);
    this.#advertiseCamera.update(delta);
    this.#composer.render(delta);
    this.#animationFrame = window.requestAnimationFrame(this.#render);
  };

  readonly #unlockAudio = (): void => {
    void this.#audio.unlock();
  };

  readonly #handleVisibilityChange = (): void => {
    this.#advertiseDemo.setPageVisible(document.visibilityState === "visible");
  };

  readonly #handleReducedMotionChange = (event: MediaQueryListEvent): void => {
    this.#advertiseDemo.setReducedMotion(event.matches);
    this.#advertiseCamera.setReducedMotion(event.matches);
    this.#droneCamera.setReducedMotion(event.matches);
  };

  #syncViewerCameraMode(): void {
    const droneEnabled =
      this.#viewerCameraAvailable && this.#viewerCameraMode === "drone";
    if (droneEnabled) {
      const target = this.#freeView.target;
      this.#freeView.setEnabled(false);
      this.#droneCamera.setEnabled(true, target);
      return;
    }

    const droneWasEnabled = this.#droneCamera.isEnabled;
    const droneTarget = this.#droneCamera.target;
    this.#droneCamera.setEnabled(false);
    if (this.#viewerCameraAvailable && droneWasEnabled) {
      this.#freeView.adoptCurrentView(droneTarget);
    }
    this.#freeView.setEnabled(this.#viewerCameraAvailable);
  }

  #setBackgroundRuntime(
    runtime: BackgroundRuntime,
    design?: AnyFireworkDesign,
  ): void {
    this.#backgroundRuntimeKind = runtime;
    this.#backgroundRuntime.set(runtime, design);
  }

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
