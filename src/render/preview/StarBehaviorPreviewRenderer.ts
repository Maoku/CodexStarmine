import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineBasicMaterial,
  LineSegments,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

import { evaluateVirtualStarAppearance } from "../../core/particle";
import type { VirtualStarPreset } from "../../data";
import {
  buildStarBehaviorPreviewScenario,
  evaluatePreviewParticlePosition,
  type StarBehaviorPreviewScenario,
} from "./buildStarBehaviorPreviewScenario";

const MAX_PARENT_STARS = 48;
const MAX_TRAIL_VERTICES = 4_096;
const FRAME_INTERVAL_MS = 1_000 / 30;

interface RendererLike {
  dispose(): void;
  domElement: HTMLCanvasElement;
  forceContextLoss?(): void;
  render(scene: Scene, camera: OrthographicCamera): void;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
}

interface ObserverLike {
  disconnect(): void;
  observe(target: Element): void;
}

export interface StarBehaviorPreviewRendererDependencies {
  cancelAnimationFrame: (handle: number) => void;
  createIntersectionObserver?: (
    callback: (visible: boolean) => void,
  ) => ObserverLike;
  createRenderer: () => RendererLike;
  createResizeObserver?: (callback: () => void) => ObserverLike;
  now: () => number;
  reducedMotion: () => boolean;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
}

const DEFAULT_DEPENDENCIES: StarBehaviorPreviewRendererDependencies = {
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
  createIntersectionObserver:
    typeof IntersectionObserver === "undefined"
      ? undefined
      : (callback) =>
          new IntersectionObserver((entries) =>
            callback(entries.some((entry) => entry.isIntersecting)),
          ),
  createRenderer: () =>
    new WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    }),
  createResizeObserver:
    typeof ResizeObserver === "undefined"
      ? undefined
      : (callback) => new ResizeObserver(callback),
  now: () => performance.now(),
  reducedMotion: () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
};

function createPointMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float glow = 1.0 - smoothstep(0.08, 0.5, d);
        float core = 1.0 - smoothstep(0.0, 0.16, d);
        float alpha = (glow * 0.64 + core) * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor * (0.86 + core * 1.5), alpha);
      }
    `,
    transparent: true,
    vertexColors: true,
    vertexShader: `
      attribute float alpha;
      attribute float pointSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = alpha;
        gl_PointSize = pointSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
}

function createPointGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const attributes = {
    alpha: new BufferAttribute(new Float32Array(MAX_PARENT_STARS), 1),
    color: new BufferAttribute(new Float32Array(MAX_PARENT_STARS * 3), 3),
    pointSize: new BufferAttribute(new Float32Array(MAX_PARENT_STARS), 1),
    position: new BufferAttribute(new Float32Array(MAX_PARENT_STARS * 3), 3),
  };
  Object.entries(attributes).forEach(([name, attribute]) => {
    attribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
  });
  geometry.setDrawRange(0, 0);
  return geometry;
}

export class StarBehaviorPreviewRenderer {
  readonly #camera = new OrthographicCamera(-24, 24, 14, -14, 0.1, 120);
  readonly #dependencies: StarBehaviorPreviewRendererDependencies;
  readonly #pointGeometry = createPointGeometry();
  readonly #pointMaterial = createPointMaterial();
  readonly #points = new Points(this.#pointGeometry, this.#pointMaterial);
  readonly #scene = new Scene();
  readonly #tempColor = new Color();
  readonly #trailGeometry = new BufferGeometry();
  readonly #trailMaterial = new LineBasicMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    opacity: 0.62,
    transparent: true,
    vertexColors: true,
  });
  readonly #trails: LineSegments;
  #destroyed = false;
  #elapsed = 0;
  #failed = false;
  #frame = 0;
  #host?: HTMLElement;
  #intersectionObserver?: ObserverLike;
  #lastFrameTime = -Infinity;
  #looping = true;
  #onScreen = true;
  #renderer?: RendererLike;
  #resizeObserver?: ObserverLike;
  #running = false;
  #scenario?: StarBehaviorPreviewScenario;
  #signature = "";
  #star?: VirtualStarPreset;
  #startedAt = 0;

  constructor(
    dependencies: Partial<StarBehaviorPreviewRendererDependencies> = {},
  ) {
    this.#dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencies };
    this.#camera.position.z = 60;
    const trailPosition = new BufferAttribute(
      new Float32Array(MAX_TRAIL_VERTICES * 3),
      3,
    );
    const trailColor = new BufferAttribute(
      new Float32Array(MAX_TRAIL_VERTICES * 3),
      3,
    );
    trailPosition.setUsage(DynamicDrawUsage);
    trailColor.setUsage(DynamicDrawUsage);
    this.#trailGeometry.setAttribute("position", trailPosition);
    this.#trailGeometry.setAttribute("color", trailColor);
    this.#trailGeometry.setDrawRange(0, 0);
    this.#trails = new LineSegments(this.#trailGeometry, this.#trailMaterial);
    this.#scene.add(this.#trails, this.#points);
    document.addEventListener("visibilitychange", this.#handleVisibility);
  }

  get canvas(): HTMLCanvasElement | undefined {
    return this.#renderer?.domElement;
  }

  get isFallback(): boolean {
    return this.#failed;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  attach(host: HTMLElement, star: VirtualStarPreset): void {
    if (this.#destroyed) return;
    this.#host = host;
    const signature = JSON.stringify({
      burnDuration: star.burnDuration,
      colorStages: star.colorStages,
      drag: star.drag,
      effectProfile: star.effectProfile,
      gravityScale: star.gravityScale,
      id: star.id,
    });
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#star = structuredClone(star);
      this.#scenario = buildStarBehaviorPreviewScenario(star);
      this.#elapsed = 0;
    }
    if (!this.#ensureRenderer()) {
      this.#setHostState("fallback");
      return;
    }
    const canvas = this.#renderer!.domElement;
    if (canvas.parentElement !== host) host.append(canvas);
    this.#setHostState("webgl");
    this.#resize();
    this.#observeHost();
    if (this.#dependencies.reducedMotion()) {
      this.#running = false;
      this.#elapsed = (this.#scenario?.duration ?? 2) * 0.58;
      this.#renderAt(this.#elapsed);
    } else {
      this.play();
    }
  }

  detach(): void {
    this.pause();
    this.#resizeObserver?.disconnect();
    this.#intersectionObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#intersectionObserver = undefined;
    this.#host = undefined;
    if (this.#failed) this.#failed = false;
  }

  pause(): void {
    if (this.#running) {
      this.#elapsed = Math.max(
        (this.#dependencies.now() - this.#startedAt) / 1_000,
        0,
      );
    }
    this.#running = false;
    this.#cancelFrame();
  }

  play(explicit = false): void {
    if (this.#destroyed || this.#failed || !this.#renderer || !this.#scenario) {
      return;
    }
    this.#looping = !this.#dependencies.reducedMotion() || !explicit;
    if (this.#dependencies.reducedMotion() && !explicit) return;
    this.#running = true;
    this.#startedAt = this.#dependencies.now() - this.#elapsed * 1_000;
    this.#scheduleFrame();
  }

  restart(): void {
    this.#elapsed = 0;
    this.#renderAt(0);
    this.play(true);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.detach();
    document.removeEventListener("visibilitychange", this.#handleVisibility);
    this.#disposeRenderer();
    this.#pointGeometry.dispose();
    this.#pointMaterial.dispose();
    this.#trailGeometry.dispose();
    this.#trailMaterial.dispose();
  }

  #ensureRenderer(): boolean {
    if (this.#renderer) return true;
    if (this.#failed) return false;
    try {
      const renderer = this.#dependencies.createRenderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.domElement.className = "star-behavior-preview-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.addEventListener(
        "webglcontextlost",
        this.#handleContextLost,
      );
      this.#renderer = renderer;
      return true;
    } catch {
      this.#failed = true;
      return false;
    }
  }

  #disposeRenderer(): void {
    if (!this.#renderer) return;
    const canvas = this.#renderer.domElement;
    canvas.removeEventListener("webglcontextlost", this.#handleContextLost);
    canvas.remove();
    this.#renderer.dispose();
    this.#renderer.forceContextLoss?.();
    this.#renderer = undefined;
  }

  #observeHost(): void {
    this.#resizeObserver?.disconnect();
    this.#intersectionObserver?.disconnect();
    this.#resizeObserver = this.#dependencies.createResizeObserver?.(() =>
      this.#resize(),
    );
    this.#resizeObserver?.observe(this.#host!);
    this.#intersectionObserver =
      this.#dependencies.createIntersectionObserver?.((visible) => {
        this.#onScreen = visible;
        if (visible && this.#running) this.#scheduleFrame();
        else this.#cancelFrame();
      });
    this.#intersectionObserver?.observe(this.#host!);
  }

  #resize(): void {
    if (!this.#renderer || !this.#host) return;
    const bounds = this.#host.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    this.#renderer.setSize(
      Math.round(bounds.width),
      Math.round(bounds.height),
      false,
    );
    const aspect = bounds.width / bounds.height;
    this.#camera.left = -14 * aspect;
    this.#camera.right = 14 * aspect;
    this.#camera.updateProjectionMatrix();
    this.#renderAt(this.#elapsed);
  }

  #scheduleFrame(): void {
    if (this.#frame || !this.#running || !this.#onScreen || document.hidden) {
      return;
    }
    this.#frame = this.#dependencies.requestAnimationFrame(this.#tick);
  }

  #cancelFrame(): void {
    if (!this.#frame) return;
    this.#dependencies.cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  readonly #tick = (timestamp: number): void => {
    this.#frame = 0;
    if (!this.#running || !this.#scenario) return;
    if (timestamp - this.#lastFrameTime < FRAME_INTERVAL_MS) {
      this.#scheduleFrame();
      return;
    }
    this.#lastFrameTime = timestamp;
    const rawElapsed = Math.max(
      (this.#dependencies.now() - this.#startedAt) / 1_000,
      0,
    );
    if (!this.#looping && rawElapsed >= this.#scenario.duration) {
      this.#elapsed = this.#scenario.duration;
      this.#renderAt(this.#elapsed);
      this.#running = false;
      return;
    }
    this.#elapsed = this.#looping
      ? rawElapsed % this.#scenario.duration
      : rawElapsed;
    this.#renderAt(this.#elapsed);
    this.#scheduleFrame();
  };

  #renderAt(elapsed: number): void {
    if (!this.#renderer || !this.#scenario || !this.#star) return;
    const position = this.#pointGeometry.getAttribute(
      "position",
    ) as BufferAttribute;
    const color = this.#pointGeometry.getAttribute("color") as BufferAttribute;
    const alpha = this.#pointGeometry.getAttribute("alpha") as BufferAttribute;
    const pointSize = this.#pointGeometry.getAttribute(
      "pointSize",
    ) as BufferAttribute;
    const trailPosition = this.#trailGeometry.getAttribute(
      "position",
    ) as BufferAttribute;
    const trailColor = this.#trailGeometry.getAttribute(
      "color",
    ) as BufferAttribute;
    const age = elapsed - this.#scenario.blackoutDuration;
    let visible = 0;
    let trailVertex = 0;
    for (const particle of this.#scenario.particles) {
      if (visible >= MAX_PARENT_STARS || age < 0 || age >= particle.lifetime) {
        continue;
      }
      const appearance = evaluateVirtualStarAppearance({
        ageSeconds: age,
        colorStages: this.#star.colorStages,
        effectPhase: particle.effectPhase,
        effectProfile: this.#star.effectProfile,
        effectSeed: particle.effectSeed,
        legacyFlicker: this.#star.flicker,
        lifetimeSeconds: particle.lifetime,
      });
      const point = evaluatePreviewParticlePosition(particle, this.#star, age);
      this.#tempColor.setHex(appearance.color);
      position.setXYZ(visible, point.x, point.y, point.z);
      color.setXYZ(
        visible,
        this.#tempColor.r,
        this.#tempColor.g,
        this.#tempColor.b,
      );
      alpha.setX(
        visible,
        Math.max(
          appearance.intensity *
            appearance.lightMultiplier *
            this.#star.brightness,
          0,
        ),
      );
      pointSize.setX(visible, 4.2 + this.#star.trailWidth * 1.6);
      visible += 1;

      if (this.#star.trailLifetime <= 0.14) continue;
      const samples = 5;
      this.#tempColor.setHex(appearance.trailColor);
      for (
        let sample = 1;
        sample < samples && trailVertex + 2 <= MAX_TRAIL_VERTICES;
        sample += 1
      ) {
        const currentAge = Math.max(
          age - (sample / samples) * Math.min(this.#star.trailLifetime, age),
          0,
        );
        const previousAge = Math.max(
          age -
            ((sample + 1) / samples) * Math.min(this.#star.trailLifetime, age),
          0,
        );
        const current = evaluatePreviewParticlePosition(
          particle,
          this.#star,
          currentAge,
        );
        const previous = evaluatePreviewParticlePosition(
          particle,
          this.#star,
          previousAge,
        );
        const fade = (1 - sample / samples) * appearance.trailLightMultiplier;
        trailPosition.setXYZ(trailVertex, previous.x, previous.y, previous.z);
        trailColor.setXYZ(
          trailVertex,
          this.#tempColor.r * fade * 0.25,
          this.#tempColor.g * fade * 0.25,
          this.#tempColor.b * fade * 0.25,
        );
        trailVertex += 1;
        trailPosition.setXYZ(trailVertex, current.x, current.y, current.z);
        trailColor.setXYZ(
          trailVertex,
          this.#tempColor.r * fade,
          this.#tempColor.g * fade,
          this.#tempColor.b * fade,
        );
        trailVertex += 1;
      }
    }
    for (const attribute of [position, color, alpha, pointSize]) {
      attribute.needsUpdate = true;
    }
    trailPosition.needsUpdate = true;
    trailColor.needsUpdate = true;
    this.#pointGeometry.setDrawRange(0, visible);
    this.#trailGeometry.setDrawRange(0, trailVertex);
    this.#renderer.render(this.#scene, this.#camera);
  }

  #setHostState(state: "fallback" | "webgl"): void {
    if (this.#host) this.#host.dataset.previewState = state;
  }

  readonly #handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.pause();
    this.#failed = true;
    this.#setHostState("fallback");
    this.#disposeRenderer();
  };

  readonly #handleVisibility = (): void => {
    if (document.hidden) this.#cancelFrame();
    else if (this.#running) this.#scheduleFrame();
  };
}
